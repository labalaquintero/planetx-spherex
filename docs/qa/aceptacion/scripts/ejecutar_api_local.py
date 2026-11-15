"""Ejecución manual de los casos de API contra la API local (REAL-local, NO demo, NO simulado).

Uso (desde la raíz del repo, con la API ya levantada; ver docs/qa/aceptacion/ejecuciones/):

    python -I docs/qa/aceptacion/scripts/ejecutar_api_local.py \
        --base-url http://127.0.0.1:8000 --out docs/qa/aceptacion/ejecuciones/AAAA-MM-DD-api-local.md

Solo biblioteca estándar. Una petición por caso: sin reintentos ni bucles. Los 5 casos de César
leen sus coordenadas de docs/qa/datos/matriz_5_casos.md (no se copian aquí) y cada uno hace
UNA sola consulta; si la API tuviera la búsqueda en vivo habilitada, eso es una consulta a IRSA
por caso, nunca más. NO incluye ra=0&dec=90 (límite válido) a propósito.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

REPO = Path(__file__).resolve().parents[4]
MATRIZ_CESAR = REPO / "docs" / "qa" / "datos" / "matriz_5_casos.md"
TIMEOUT_S = 40  # la ruta en vivo tiene un plazo de 25 s en la API

E422 = ("422", "invalid_coordinates")

# (id de matriz, caso, query, esperado). Ninguna de estas peticiones es una coordenada válida.
CASOS_422 = [
    ("F01-R03a", "faltante: sin parámetros", "", E422),
    ("F01-R03a", "faltante: sólo ra_deg", "?ra_deg=10.25", E422),
    ("F01-R03a", "faltante: sólo dec_deg", "?dec_deg=-12.5", E422),
    ("F01-R03a", "vacío: dec_deg=", "?ra_deg=10.25&dec_deg=", E422),
    ("F01-R03a", "vacío: ra_deg=", "?ra_deg=&dec_deg=-12.5", E422),
    ("F01-R03b", "NaN en ra_deg", "?ra_deg=NaN&dec_deg=-12.5", E422),
    ("F01-R03b", "NaN en dec_deg", "?ra_deg=10.25&dec_deg=NaN", E422),
    ("F01-R03b", "Infinity en ra_deg", "?ra_deg=Infinity&dec_deg=-12.5", E422),
    ("F01-R03b", "-Infinity en dec_deg", "?ra_deg=10.25&dec_deg=-Infinity", E422),
    ("F01-R03e", "exponente en ra_deg (1e1)", "?ra_deg=1e1&dec_deg=-12.5", E422),
    ("F01-R03e", "exponente en dec_deg (-1.25e1)", "?ra_deg=10.25&dec_deg=-1.25e1", E422),
    ("F01-R03e", "coma decimal en ra_deg (10,25)", "?ra_deg=10%2C25&dec_deg=-12.5", E422),
    ("F01-R03c", "fuera de rango: ra_deg=360", "?ra_deg=360&dec_deg=-12.5", E422),
    ("F01-R03c", "fuera de rango: ra_deg=-0.1", "?ra_deg=-0.1&dec_deg=-12.5", E422),
    ("F01-R03c", "fuera de rango: dec_deg=90.1", "?ra_deg=10.25&dec_deg=90.1", E422),
    ("F01-R03c", "fuera de rango: dec_deg=-90.1", "?ra_deg=10.25&dec_deg=-90.1", E422),
    ("F01-R03d", "repetido: ra_deg dos veces", "?ra_deg=10.25&ra_deg=11&dec_deg=-12.5", E422),
    ("F01-R03d", "repetido: dec_deg dos veces", "?ra_deg=10.25&dec_deg=-12.5&dec_deg=-13", E422),
]

# id de la matriz de aceptación -> (letra del caso en la matriz de César)
CINCO_CASOS = [
    ("F01-R09", "a"),
    ("F01-R10", "b"),
    ("F01-R11", "c"),
    ("F01-R12", "d"),
    ("F01-R13", "e"),
]


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=REPO, capture_output=True, text=True).stdout.strip()


def coordenadas_cesar() -> dict[str, tuple[str, float, float]]:
    """letra -> (objeto, ra, dec), leídas de la tabla §1 de la matriz de César (solo lectura)."""
    patron = re.compile(r"^\| \*\*([a-e])\*\* \| ([^|]+?) \| [^|]+ \| `([+-]?[\d.]+)` \| `([+-]?[\d.]+)` \|", re.M)
    filas = {m[1]: (m[2].strip(), float(m[3]), float(m[4])) for m in patron.finditer(MATRIZ_CESAR.read_text(encoding="utf-8"))}
    if sorted(filas) != list("abcde"):
        sys.exit(f"No pude leer las 5 coordenadas de {MATRIZ_CESAR}")
    return filas


def pedir(base: str, ruta: str) -> dict:
    inicio = time.monotonic()
    hora = datetime.now(timezone.utc).strftime("%H:%M:%S")
    req = urllib.request.Request(base + ruta, headers={"Accept": "application/json"})
    codigo, cuerpo, cabeceras = None, b"", {}
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as r:
            codigo, cuerpo, cabeceras = r.status, r.read(), r.headers
    except urllib.error.HTTPError as e:
        codigo, cuerpo, cabeceras = e.code, e.read(), e.headers
    except Exception as e:  # sin respuesta HTTP
        return {"codigo": None, "resumen": f"sin respuesta: {type(e).__name__}: {e}", "seg": time.monotonic() - inicio,
                "ctype": "", "extra": "", "hora": hora}
    seg = time.monotonic() - inicio
    ctype = cabeceras.get("Content-Type", "")
    resumen, extra = "", ""
    if "json" in ctype:
        try:
            j = json.loads(cuerpo)
        except ValueError:
            j = None
        if isinstance(j, dict) and "error" in j:
            resumen = f"error.code={j['error'].get('code')}"
            extra = f"message={j['error'].get('message')!r}"
        elif isinstance(j, dict) and "status" in j and "frames" in j:
            resumen = f"status={j['status']} reason={j['reason']} mode={j['mode']}"
            extra = f"frames={len(j['frames'])} warnings={j['warnings']}"
        elif isinstance(j, dict):
            resumen = json.dumps(j, ensure_ascii=False)
    elif cuerpo:
        resumen = f"cuerpo no JSON ({ctype or 'sin content-type'}, {len(cuerpo)} bytes)"
    return {"codigo": codigo, "resumen": resumen, "seg": seg, "ctype": ctype, "extra": extra, "hora": hora}


def evaluar(obs: dict, esperado_codigo: str | None, esperado_resumen: str) -> str:
    if obs["codigo"] is None:
        return "falla"
    ok_codigo = esperado_codigo is None or str(obs["codigo"]) == esperado_codigo
    ok_resumen = esperado_resumen in obs["resumen"]
    return "real-local-pasa" if ok_codigo and ok_resumen else "falla"


def celda(texto: str) -> str:
    return str(texto).replace("|", "\\|").replace("\n", " ")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="http://127.0.0.1:8000")
    ap.add_argument("--out", required=True)
    ap.add_argument("--omitir-cinco-casos", action="store_true",
                    help="no consulta los 5 casos de César (límite: una consulta por caso)")
    args = ap.parse_args()
    base = args.base_url.rstrip("/")

    ahora = datetime.now(timezone.utc)
    cabecera = {
        "sha_rama": git("rev-parse", "HEAD"),
        "sha_api": git("log", "-1", "--format=%H", "--", "api"),
        "api_modificada": bool(git("status", "--porcelain", "--", "api")),
        "inicio_utc": ahora.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }

    filas = []  # (id, caso, peticion, esperado, obs, veredicto)
    filas.append(("(health)", "GET /api/health", "/api/health", "200 · status=ok", None, None))
    obs = pedir(base, "/api/health")
    filas[-1] = (*filas[-1][:4], obs, evaluar(obs, "200", "status") if "ok" in obs["resumen"] else "falla")

    for id_, caso, query, (cod, code) in CASOS_422:
        ruta = "/api/v1/comparisons" + query
        obs = pedir(base, ruta)
        filas.append((id_, caso, ruta, f"{cod} · error.code={code}", obs, evaluar(obs, cod, f"error.code={code}")))

    ruta = "/api/v1/images/id-inexistente"
    obs = pedir(base, ruta)
    filas.append(("F01-R05", "imagen inexistente", ruta, "404 · error.code=image_not_found", obs,
                  evaluar(obs, "404", "error.code=image_not_found")))

    coords = coordenadas_cesar()
    for id_, letra in ([] if args.omitir_cinco_casos else CINCO_CASOS):  # UNA consulta por caso
        objeto, ra, dec = coords[letra]
        ruta = f"/api/v1/comparisons?ra_deg={quote(repr(ra))}&dec_deg={quote(repr(dec))}"
        obs = pedir(base, ruta)
        # 503 archive_unavailable = la API cumple el contrato pero la búsqueda en vivo aún no está
        # integrada: se registra como "bloqueado", no como "falla" ni como "pasa".
        ver = ("bloqueado" if obs["codigo"] == 503 and "error.code=archive_unavailable" in obs["resumen"]
               else evaluar(obs, "200", "status=ready"))
        filas.append((id_, f"{objeto} (caso {letra})", ruta, "200 · status=ready (PROVISIONAL)", obs, ver))

    fin = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    pasa = sum(1 for f in filas if f[5] == "real-local-pasa")
    bloq = sum(1 for f in filas if f[5] == "bloqueado")
    out = [
        f"# Ejecución de API local · {ahora:%Y-%m-%d} (UTC)",
        "",
        "**Ámbito: REAL-local.** API real levantada en la máquina de Quintero; **no es la demo desplegada** y **no es simulado** (sin mocks ni fixtures). Resultado generado por `docs/qa/aceptacion/scripts/ejecutar_api_local.py`.",
        "",
        f"- URL base: `{base}`",
        f"- SHA de la rama evaluada: `{cabecera['sha_rama']}`",
        f"- Último commit que toca `api/`: `{cabecera['sha_api']}` (`api/` modificada en el árbol: {'SÍ' if cabecera['api_modificada'] else 'no'})",
        f"- Inicio / fin (UTC): {cabecera['inicio_utc']} / {fin}",
        f"- Resultado: **{pasa} de {len(filas)}** peticiones pasan; **{bloq}** bloqueadas; **{len(filas) - pasa - bloq}** fallan",
        "",
        "| ID matriz | Caso | Petición | Esperado | Hora UTC | HTTP | Observado (status/reason/mode o error) | Detalle | s | Veredicto |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for id_, caso, ruta, esp, obs, ver in filas:
        out.append("| " + " | ".join(celda(x) for x in (
            id_, caso, f"`GET {ruta}`", esp, obs["hora"], obs["codigo"], obs["resumen"], obs["extra"], f"{obs['seg']:.2f}", ver)) + " |")
    Path(args.out).write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"{pasa}/{len(filas)} pasan, {bloq} bloqueadas; escrito {args.out}")
    for id_, caso, ruta, esp, obs, ver in filas:
        print(f"{ver:16} {id_:9} {obs['codigo']} {obs['resumen'][:70]:70} <- {caso}")


if __name__ == "__main__":
    main()
