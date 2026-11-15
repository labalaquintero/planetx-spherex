#!/usr/bin/env python3
"""Analiza los dos bocetos de «Explorar» y escribe docs/referencias/layout.json.

Medición reproducible (sin ajustes a ojo):
  1. Recorta la franja superior de la captura (filas cuyo fondo no es el del dibujo).
  2. Segmenta por color: blanco (objetos) y azul (nave y cruceta) en la navegación; trazo oscuro
     en la selección.
  3. Componentes conexas y contornos (OpenCV): centroide normalizado, caja, área relativa,
     redondez 4πA/P², relación de aspecto, solidez, ángulo y huecos (contornos hijos).
  4. Clasifica cada componente con reglas explícitas (ver `clasificar_navegacion`) y anota la
     confianza cuando la forma es ambigua.

Uso (desde experimental/explorar/):
  python3 -m venv /tmp/explorar-venv
  /tmp/explorar-venv/bin/pip install -r tools/requirements-analisis.txt
  /tmp/explorar-venv/bin/python tools/analizar_bocetos.py            # escribe el JSON
  /tmp/explorar-venv/bin/python tools/analizar_bocetos.py --debug /tmp/explorar-analisis  # + imágenes

Coordenadas: u = x / ancho, v = y / alto, ambas en [0, 1] sobre el área de dibujo (sin la franja).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

import cv2
import numpy as np

RAIZ = Path(__file__).resolve().parent.parent
REF = RAIZ / "docs" / "referencias"
NAV = REF / "boceto-navegacion.png"
SEL = REF / "boceto-seleccion.png"
SALIDA = REF / "layout.json"

R4 = lambda x: round(float(x), 4)  # noqa: E731


# ----------------------------------------------------------------------------- utilidades
def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def franja_superior(img: np.ndarray) -> int:
    """Filas iniciales cuyo brillo mediano difiere del fondo del dibujo (barra de la captura)."""
    gris = img.mean(axis=2)
    fondo = float(np.median(gris))
    filas = np.median(gris, axis=1)
    n = 0
    while n < len(filas) // 4 and abs(filas[n] - fondo) > 4:
        n += 1
    return n


def medir(mask: np.ndarray, etiqueta: np.ndarray, idx: int, ancho: int, alto: int, min_hueco: int) -> dict:
    comp = (etiqueta == idx).astype(np.uint8)
    contornos, jerarquia = cv2.findContours(comp, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    externos = [c for c, h in zip(contornos, jerarquia[0]) if h[3] < 0]
    ext = max(externos, key=cv2.contourArea)
    huecos = [cv2.contourArea(c) for c, h in zip(contornos, jerarquia[0]) if h[3] >= 0 and cv2.contourArea(c) >= min_hueco]
    area = float(comp.sum())
    x, y, w, h = cv2.boundingRect(ext)
    per = cv2.arcLength(ext, True)
    casco = cv2.contourArea(cv2.convexHull(ext))
    m = cv2.moments(comp, binaryImage=True)
    cx, cy = m["m10"] / m["m00"], m["m01"] / m["m00"]
    # Orientación por momentos de segundo orden (ángulo del eje mayor, grados, horario en imagen).
    ang = 0.5 * math.degrees(math.atan2(2 * m["mu11"], m["mu20"] - m["mu02"]))
    ejes = np.sqrt(np.linalg.eigvalsh(np.array([[m["mu20"], m["mu11"]], [m["mu11"], m["mu02"]]]) / m["m00"]))
    return {
        "centroide": [R4(cx / ancho), R4(cy / alto)],
        "caja": [R4(x / ancho), R4(y / alto), R4(w / ancho), R4(h / alto)],
        "caja_px": [int(x), int(y), int(w), int(h)],
        "area_rel": R4(area / (ancho * alto)),
        "tamano_rel": R4(max(w, h) / alto),
        "redondez": R4(4 * math.pi * cv2.contourArea(ext) / (per * per)) if per else 0.0,
        "aspecto": R4(w / h),
        "solidez": R4(cv2.contourArea(ext) / casco) if casco else 0.0,
        "angulo_deg": R4(ang),
        "elongacion": R4(ejes[1] / ejes[0]) if ejes[0] > 0 else 0.0,
        "huecos": len(huecos),
        "area_hueco_rel": R4(max(huecos) / (ancho * alto)) if huecos else 0.0,
        "toca_borde": bool(x <= 1 or y <= 1 or x + w >= ancho - 1 or y + h >= alto - 1),
    }


def componentes(mask: np.ndarray, area_min: int, min_hueco: int) -> list[dict]:
    alto, ancho = mask.shape
    n, etiqueta, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    out = []
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < area_min:
            continue
        out.append(medir(mask, etiqueta, i, ancho, alto, min_hueco))
    return out


# ------------------------------------------------------------------------------ navegación
def mascaras_navegacion(img: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    r, g, b = (img[..., i].astype(int) for i in range(3))
    blanco = ((np.minimum(np.minimum(r, g), b) > 170)).astype(np.uint8)
    azul = ((b > 100) & (b > r + 45) & (b > g + 60)).astype(np.uint8)
    # Cierre: une trazos y tapa el texto gris superpuesto a una mancha; no cierra huecos reales (> 15 px).
    blanco = cv2.morphologyEx(blanco, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    azul = cv2.morphologyEx(azul, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    return blanco, azul


def clasificar_navegacion(objs: list[dict]) -> list[dict]:
    """Reglas (en orden), con la descripción del boceto como guía:
    1. Con hueco y alargado (aspecto ≥ 1,6)                    → station  (cilindro con asa)
    2. Las dos manchas más grandes del tercio izquierdo, arriba  → planet
    3. La mayor de la mitad derecha, arriba, irregular          → ringedPlanet
    4. Entre las redondas restantes de la mitad derecha, la más
       cercana al «centro-derecha» (0,70; 0,55)                   → sphere
    5. El resto                                                  → smallBody
    """
    resto = list(objs)
    for o in resto:
        o["clase"] = None
        o["confianza"] = "alta"
        o["nota"] = ""

    def tomar(pred, key, n=1):
        cand = sorted([o for o in resto if o["clase"] is None and pred(o)], key=key)
        return cand[:n]

    for o in tomar(lambda o: o["huecos"] >= 1 and o["aspecto"] >= 1.6, key=lambda o: -o["area_rel"]):
        o["clase"] = "station"
        o["nota"] = "Cilindro horizontal con un asa (anillo) en el extremo derecho; el asa encierra un hueco."
    for o in tomar(lambda o: o["centroide"][0] < 0.33 and o["centroide"][1] < 0.5, key=lambda o: -o["tamano_rel"], n=2):
        o["clase"] = "planet"
        if o["toca_borde"]:
            o["confianza"] = "media"
            o["nota"] = "Recortado por el borde superior: solo se ve la mitad inferior. Se completa como esfera del mismo ancho."
    for o in tomar(lambda o: o["centroide"][0] > 0.5 and o["centroide"][1] < 0.5 and o["area_rel"] > 0.004, key=lambda o: -o["area_rel"]):
        o["clase"] = "ringedPlanet"
        o["confianza"] = "media"
        o["nota"] = (
            "Mancha irregular con una prolongación inclinada (el anillo) y trazos sueltos; el disco y el anillo "
            "se funden. Inclinación del anillo tomada del eje mayor."
        )
    centro_der = (0.70, 0.55)
    for o in tomar(
        lambda o: o["centroide"][0] > 0.55 and o["redondez"] >= 0.7,
        key=lambda o: math.dist(o["centroide"], centro_der),
    ):
        o["clase"] = "sphere"
        o["confianza"] = "media"
        o["nota"] = "Hay dos manchas redondas a la derecha; se toma la más cercana al centro-derecha. La otra queda como cuerpo pequeño."
    for o in resto:
        if o["clase"] is None:
            o["clase"] = "smallBody"
            if o["redondez"] < 0.6:
                o["nota"] = "Forma irregular (triangular o alargada)."
    return resto


def silueta_nave(azul: np.ndarray, ancho: int, alto: int) -> tuple[dict, list[dict], np.ndarray]:
    n, etiqueta, stats, cents = cv2.connectedComponentsWithStats(azul, connectivity=8)
    nave = np.zeros_like(azul)
    resto = []
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < 30:
            continue
        cx = cents[i][0] / ancho
        if 0.25 < cx < 0.75:
            nave[etiqueta == i] = 1
        else:
            resto.append(i)
    # Silueta: contorno exterior relleno (el dibujo es de líneas).
    cerrada = cv2.dilate(nave, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    contornos, _ = cv2.findContours(cerrada, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    sil = np.zeros_like(nave)
    cv2.drawContours(sil, contornos, -1, 1, thickness=cv2.FILLED)
    ys, xs = np.nonzero(sil)
    top, bot, left, right = ys.min(), ys.max(), xs.min(), xs.max()
    largo, env = bot - top, right - left
    anchos = np.array([sil[y].sum() for y in range(top, bot + 1)])
    base = float(np.median(anchos[-12:-3]))  # ancho del cuerpo/motor cerca de la base
    # Trazos horizontales internos (base de la nariz, cajas del cuerpo y del motor): filas con un
    # recorrido continuo largo, tras engrosar el trazo en vertical (las líneas están algo inclinadas).
    grueso = cv2.dilate(nave, np.ones((11, 1), np.uint8))
    filas = []
    for y in range(top, bot + 1):
        mejor = actual = 0
        for v in grueso[y]:
            actual = actual + 1 if v else 0
            mejor = max(mejor, actual)
        if mejor >= 0.55 * base:
            filas.append(y)
    lineas: list[int] = []
    grupo: list[int] = []
    for y in filas:
        if grupo and y - grupo[-1] > 3:
            lineas.append(int(np.median(grupo)))
            grupo = []
        grupo.append(y)
    if grupo:
        lineas.append(int(np.median(grupo)))
    # Base de la nariz = primera línea; caja del motor = entre las dos últimas.
    j = (lineas[0] - top) if lineas else int(np.argmax(anchos >= base * 0.85))
    motor_top = lineas[-2] if len(lineas) >= 3 else bot - int(0.15 * (bot - top))
    motor_alto = bot - motor_top
    # Puntas de ala: puntos extremos.
    yl = int(np.median(ys[xs <= left + 2]))
    yr = int(np.median(ys[xs >= right - 2]))
    xn = int(np.median(xs[ys <= top + 2]))
    m = lambda x, y: [R4(x / ancho), R4(y / alto)]  # noqa: E731
    datos = {
        "caja": [R4(left / ancho), R4(top / alto), R4(env / ancho), R4(largo / alto)],
        "puntos": {
            "nariz": m(xn, top),
            "ala_izquierda": m(left, yl),
            "ala_derecha": m(right, yr),
            "hombro": m(xn, top + j),
            "motor_abajo": m(xn, bot),
            "motor_arriba": m(xn, motor_top),
        },
        "lineas_horizontales_v": [R4(y / alto) for y in lineas],
        # Proporciones en píxeles (isótropas): no dependen de la relación de aspecto de la pantalla.
        "proporciones": {
            "envergadura_sobre_largo": R4(env / largo),
            "nariz_sobre_largo": R4(j / largo),
            "ancho_cuerpo_sobre_envergadura": R4(base / env),
            "alto_motor_sobre_largo": R4(motor_alto / largo),
            "punta_ala_desde_nariz_sobre_largo": R4(((yl + yr) / 2 - top) / largo),
            "barrido_borde_ataque_deg": R4(
                math.degrees(math.atan2(((yl + yr) / 2) - (top + j), (env / 2) - base / 2))
            ),
        },
        "largo_rel_alto": R4(largo / alto),
        "envergadura_rel_ancho": R4(env / ancho),
    }
    return datos, resto, sil


def cruceta(azul: np.ndarray, ancho: int, alto: int) -> dict:
    zona = azul.copy()
    zona[:, : int(ancho * 0.8)] = 0
    zona[: int(alto * 0.5)] = 0
    cs = componentes(zona, 60, 20)
    # Cuadrados = componentes no contenidas en la caja de otra (los triángulos van dentro).
    def dentro(a, b):
        ax, ay, aw, ah = a["caja_px"]
        bx, by, bw, bh = b["caja_px"]
        return a is not b and ax >= bx and ay >= by and ax + aw <= bx + bw and ay + ah <= by + bh
    cuadros = [c for c in cs if not any(dentro(c, o) for o in cs)]
    cx = np.mean([c["centroide"][0] for c in cuadros])
    cy = np.mean([c["centroide"][1] for c in cuadros])
    botones = {}
    for c in cuadros:
        dx, dy = c["centroide"][0] - cx, (c["centroide"][1] - cy) * alto / ancho
        d = "derecha" if abs(dx) > abs(dy) and dx > 0 else "izquierda" if abs(dx) > abs(dy) else "abajo" if dy > 0 else "arriba"
        tri = [o for o in cs if dentro(o, c)]
        botones[d] = {
            "centroide": c["centroide"],
            "caja": c["caja"],
            "toca_borde": c["toca_borde"],
            "triangulo": bool(tri),
        }
    return {
        "centro": [R4(cx), R4(cy)],
        "botones": botones,
        "disposicion": "cruz" if set(botones) == {"arriba", "abajo", "izquierda", "derecha"} else "incompleta",
        "nota": "El botón derecho está cortado por el borde de la captura." if botones.get("derecha", {}).get("toca_borde") else "",
    }


# ------------------------------------------------------------------------------- selección
def analizar_seleccion(img: np.ndarray) -> dict:
    franja = franja_superior(img)
    img = img[franja:]
    alto, ancho = img.shape[:2]
    # Umbral claro (< 200): los trazos están suavizados y con 128 se cortan.
    oscuro = (img.mean(axis=2) < 200).astype(np.uint8)

    # Marco: las columnas y filas con los recorridos oscuros más largos (líneas del rectángulo).
    def recorrido_max(a: np.ndarray) -> int:
        mejor = actual = 0
        for v in a:
            actual = actual + 1 if v else 0
            mejor = max(mejor, actual)
        return mejor

    cols = [x for x in range(ancho) if recorrido_max(oscuro[:, x]) > 0.6 * alto]
    filas = [y for y in range(alto) if recorrido_max(oscuro[y, :]) > 0.3 * ancho]
    fx, fy = min(cols), min(filas)
    # El lado derecho del marco está entrecortado: se toma el extremo de la línea superior.
    fila_sup = oscuro[fy]
    fw = int(np.nonzero(fila_sup)[0].max()) - fx
    fh = max(filas) - fy
    marco = {"caja": [R4(fx / ancho), R4(fy / alto), R4(fw / ancho), R4(fh / alto)]}
    # Cierre de 4 px: cierra los círculos hechos a mano (con pequeños huecos en el trazo).
    oscuro = cv2.morphologyEx(oscuro, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (4, 4)))
    cs = [c for c in componentes(oscuro, 40, 40) if c["caja_px"][2] < 0.5 * ancho and c["caja_px"][3] < 0.5 * alto]

    def rel(c):  # coordenadas dentro del marco
        x, y, w, h = c["caja_px"]
        return [R4((x + w / 2 - fx) / fw), R4((y + h / 2 - fy) / fh)], [R4(w / fw), R4(h / fh)]

    dentro = [c for c in cs if fx < c["caja_px"][0] < fx + fw and fy < c["caja_px"][1] < fy + fh]
    fuera = [c for c in cs if c not in dentro]

    def es_circulo(c: dict) -> bool:
        # Lazo cerrado, macizo por fuera (solidez alta), casi tan alto como ancho y pequeño.
        return c["huecos"] >= 1 and c["solidez"] >= 0.9 and 0.75 <= c["aspecto"] <= 1.35 and c["caja_px"][2] < fw * 0.12

    circulos = [c for c in dentro if es_circulo(c)]
    # Ícono de menú: la componente de arriba a la izquierda, cuadrada, con varios trazos dentro.
    menu = min(
        [c for c in dentro if c not in circulos and c["aspecto"] > 0.7 and c["aspecto"] < 1.4],
        key=lambda c: c["caja_px"][0] + c["caja_px"][1],
    )
    # Asignación α/β/ε por posición (la consigna: α arriba izquierda, β arriba derecha, ε centro-abajo).
    por_v = sorted(circulos, key=lambda c: c["centroide"][1])
    arriba, abajo = sorted(por_v[:2], key=lambda c: c["centroide"][0]), por_v[2:]
    nombres = {"alpha": arriba[0], "beta": arriba[1], "epsilon": abajo[0]}
    sectores = {}
    for k, c in nombres.items():
        (u, v), (w, h) = rel(c)
        # Etiqueta: trazo sin hueco justo encima del círculo.
        eti = [
            o for o in dentro
            if o not in circulos and o is not menu
            and abs(o["centroide"][0] - c["centroide"][0]) < 0.03
            and 0 < c["caja_px"][1] - (o["caja_px"][1] + o["caja_px"][3]) < c["caja_px"][3] * 1.5
        ]
        sectores[k] = {
            "centro": [u, v],
            "diametro_rel_marco": R4((w + h) / 2),
            "redondez": c["redondez"],
            "etiqueta_encima": bool(eti),
        }
    (mu, mv), (mw, mh) = rel(menu)
    # Llamada (fuera del marco): círculo + trazos horizontales a su derecha.
    circ_fuera = [c for c in fuera if es_circulo(c)]
    llamada = None
    if circ_fuera:
        cf = min(circ_fuera, key=lambda c: c["caja_px"][1])
        lineas = [o for o in fuera if o["aspecto"] > 3 and o["caja_px"][0] > cf["caja_px"][0] + cf["caja_px"][2] * 0.5
                  and abs(o["centroide"][1] - cf["centroide"][1]) < 0.12]
        if lineas:
            ext = max(o["caja_px"][0] + o["caja_px"][2] for o in lineas)
            llamada = {
                "lado": "derecha",
                "desplazamiento_rel_diametro": R4((ext - (cf["caja_px"][0] + cf["caja_px"][2])) / cf["caja_px"][2]),
                "alineacion_vertical": "centrada",
                "lineas_guia": len(lineas),
                "nota": "Trazos que salen del círculo hacia la derecha y terminan en el texto «sector el cual quieren visitar».",
            }
    cajas = sorted(
        [o for o in fuera if o["huecos"] >= 1 and o["aspecto"] > 1.5 and o["caja_px"][2] > 80],
        key=lambda o: o["caja_px"][0],
    )
    return {
        "archivo": SEL.name,
        "sha256": sha256(SEL),
        "tamano_px": [int(ancho), int(alto + franja)],
        "franja_superior_px": int(franja),
        "marco": {"caja": marco["caja"], "aspecto": R4(fw / fh)},
        "circulos_detectados": len(circulos),
        "menu": {"centro": [mu, mv], "tamano_rel_marco": [mw, mh], "posicion": "arriba a la izquierda, dentro del marco"},
        "sectores": sectores,
        "llamada": llamada,
        "anotaciones": {
            "cajas_flujo": len(cajas),
            "nota": "Fuera del marco: «Menu → Exp» (dos cajas y una flecha) y un círculo encima de «Menu». Se lee como "
            "«el menú lleva a la sección Explorar». No es parte de la pantalla.",
        },
    }


# --------------------------------------------------------------------------------- principal
def analizar_navegacion(img: np.ndarray, debug: Path | None) -> dict:
    franja = franja_superior(img)
    img = img[franja:]
    alto, ancho = img.shape[:2]
    blanco, azul = mascaras_navegacion(img)
    # 80 px: las estrellas del fondo miden ≤ 40 px; el cuerpo más pequeño del dibujo, ~100.
    objs = clasificar_navegacion(componentes(blanco, 80, 80))
    nave, _, sil = silueta_nave(azul, ancho, alto)
    cruz = cruceta(azul, ancho, alto)
    ids = {"planet": ["ilmara", "veshta"], "ringedPlanet": ["orun"], "station": ["ancla"], "sphere": ["esfera"]}
    # Los planetas: el de mayor área visible es Ilmara (abajo); el recortado de arriba, Veshta.
    objs.sort(key=lambda o: (o["clase"], -o["area_rel"]))
    contadores: dict[str, int] = {}
    for o in objs:
        lista = ids.get(o["clase"])
        i = contadores.get(o["clase"], 0)
        contadores[o["clase"]] = i + 1
        o["id"] = lista[i] if lista and i < len(lista) else f"c{i + 1}"
    if debug:
        debug.mkdir(parents=True, exist_ok=True)
        vis = img[..., ::-1].copy()
        for o in objs:
            x, y, w, h = o["caja_px"]
            cv2.rectangle(vis, (x, y), (x + w, y + h), (0, 200, 255), 1)
            cv2.putText(vis, f'{o["id"]}:{o["clase"]}', (x, y - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 255), 1)
        cv2.imwrite(str(debug / "navegacion-objetos.png"), vis)
        cv2.imwrite(str(debug / "navegacion-silueta.png"), sil * 255)
    for o in objs:
        o.pop("caja_px", None)
    return {
        "archivo": NAV.name,
        "sha256": sha256(NAV),
        "tamano_px": [int(ancho), int(alto + franja)],
        "franja_superior_px": int(franja),
        "aspecto": R4(ancho / alto),
        "objetos": sorted(objs, key=lambda o: o["id"]),
        "nave": nave,
        "cruceta": cruz,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--debug", type=Path, help="carpeta (fuera del repo) para imágenes de control")
    ap.add_argument("--salida", type=Path, default=SALIDA)
    args = ap.parse_args()
    for p in (NAV, SEL):
        if not p.exists():
            raise SystemExit(f"Falta el boceto: {p}")
    nav = analizar_navegacion(cv2.imread(str(NAV))[..., ::-1], args.debug)
    sel = analizar_seleccion(cv2.imread(str(SEL))[..., ::-1])
    datos = {
        "version": 1,
        "generado_por": "tools/analizar_bocetos.py",
        "coordenadas": "u = x/ancho, v = y/alto en [0,1] sobre el área de dibujo, sin la franja superior de la captura",
        "navegacion": nav,
        "seleccion": sel,
    }
    args.salida.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"escrito {args.salida.relative_to(RAIZ) if args.salida.is_relative_to(RAIZ) else args.salida}")
    for o in nav["objetos"]:
        print(f'  {o["id"]:8} {o["clase"]:13} c=({o["centroide"][0]:.3f},{o["centroide"][1]:.3f}) '
              f'tam={o["tamano_rel"]:.3f} red={o["redondez"]:.2f} asp={o["aspecto"]:.2f} huecos={o["huecos"]} '
              f'conf={o["confianza"]}')


if __name__ == "__main__":
    main()
