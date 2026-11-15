#!/usr/bin/env python3
"""Texturas de planeta a partir de las imágenes de SPHEREx que ya están en el repo (sin red).

Fuentes (NASA/JPL-Caltech, «Courtesy NASA/JPL-Caltech»; ver ATTRIBUTIONS.md):
  - Primer mapa infrarrojo de todo el cielo de SPHEREx (PIA26600), en proyección de Mollweide.
  - Región molecular de Vela vista por SPHEREx (PIA26354).
Están en docs/decisiones/prototipo-interfaces/assets/ (las mismas que usa el visor en web/public).

Qué hace:
  - cielo-spherex.webp: el mapa del cielo reproyectado de Mollweide a equirectangular. Es una esfera
    de verdad (el cielo visto desde dentro), así que se envuelve sin costuras sobre el planeta.
  - vela-spherex.webp: la imagen de Vela sin estrellas (filtro de mediana), suavizada, estirada en
    franjas horizontales y en espejo para que no tenga costura; los polos tienden al color medio.
  - lazos-spherex.webp, filamentos-spherex.webp: recortes del mapa del cielo (los lazos sobre el centro de
    la galaxia y los filamentos de polvo del sur), envueltos sin costura.
  - nebulosa-vela.webp: la nebulosa naranja de la imagen de Vela, sin estrellas.
  - Vistas previas pequeñas de ambas imágenes para la ficha del HUD (src/sectors/beta/referencias/).

Uso (desde experimental/explorar/, con numpy, Pillow y scipy en un entorno fuera del repo):
  <venv>/python tools/texturas_spherex.py
Determinista: mismas entradas, mismos archivos.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

RAIZ = Path(__file__).resolve().parent.parent
REPO = RAIZ.parent.parent
FUENTES = REPO / "docs" / "decisiones" / "prototipo-interfaces" / "assets"
TEXTURAS = RAIZ / "src" / "scene" / "assets"
FICHAS = RAIZ / "src" / "sectors" / "beta" / "referencias"
TAM = (1024, 512)


def cargar(nombre: str) -> np.ndarray:
    return np.asarray(Image.open(FUENTES / nombre).convert("RGB"), dtype=np.float32) / 255.0


def guardar(arr: np.ndarray, destino: Path, calidad: int) -> None:
    im = Image.fromarray(np.clip(arr * 255.0 + 0.5, 0, 255).astype(np.uint8), "RGB")
    im.save(destino, "WEBP", quality=calidad, method=6)
    print(f"{destino.relative_to(RAIZ)}  {im.size[0]}×{im.size[1]}  {destino.stat().st_size / 1024:.1f} KB")


def elipse(img: np.ndarray) -> tuple[float, float, float, float]:
    """Centro y semiejes de la elipse de Mollweide (lo que no es fondo negro)."""
    lum = img.mean(axis=2)
    filas = np.where(lum.max(axis=1) > 0.12)[0]
    cols = np.where(lum.max(axis=0) > 0.12)[0]
    cy, cx = (filas[0] + filas[-1]) / 2, (cols[0] + cols[-1]) / 2
    return cx, cy, (cols[-1] - cols[0]) / 2, (filas[-1] - filas[0]) / 2


def mollweide_a_equirect(img: np.ndarray, tam: tuple[int, int] = TAM) -> np.ndarray:
    cx, cy, a, b = elipse(img)
    a *= 0.985  # sin el contorno blanco de la elipse
    b *= 0.985
    w, h = tam
    lon = (np.arange(w) + 0.5) / w * 2 * np.pi - np.pi
    lat = np.pi / 2 - (np.arange(h) + 0.5) / h * np.pi
    lon, lat = np.meshgrid(lon, lat)
    # 2θ + sin 2θ = π sin φ (Newton).
    th = lat.copy()
    for _ in range(12):
        f = 2 * th + np.sin(2 * th) - np.pi * np.sin(lat)
        th -= f / (2 + 2 * np.cos(2 * th) + 1e-9)
    x = lon / np.pi * np.cos(th)  # -1..1 a lo ancho
    y = np.sin(th)  # -1..1 a lo alto
    px = cx + x * a
    py = cy - y * b
    out = np.stack([ndimage.map_coordinates(img[..., c], [py, px], order=1, mode="nearest") for c in range(3)], axis=-1)
    # Como superficie de planeta, el fondo negro del mapa lo dejaría casi negro: se realzan los tonos
    # medios (polvo y filamentos) y el espacio vacío pasa a un azul violeta muy oscuro.
    fondo = np.array([0.05, 0.04, 0.11], dtype=np.float32)
    return np.clip(fondo + np.power(np.clip(out, 0, 1), 0.72) * (1 - fondo), 0, 1)


def sin_estrellas_en_franjas(img: np.ndarray) -> np.ndarray:
    # Bordes negros del mosaico: se rellenan con el entorno (convolución normalizada).
    lum = img.mean(axis=2)
    valido = (lum > 0.02).astype(np.float32)
    pequeno = np.asarray(Image.fromarray((img * 255).astype(np.uint8)).resize((1024, 506), Image.Resampling.LANCZOS), dtype=np.float32) / 255.0
    val = np.asarray(Image.fromarray((valido * 255).astype(np.uint8)).resize((1024, 506), Image.Resampling.BILINEAR), dtype=np.float32) / 255.0
    # Sin estrellas: apertura morfológica (borra puntos más pequeños que el elemento, también las
    # estrellas brillantes) y después mediana. Queda el gas, el polvo y las nebulosas.
    sin = np.stack([ndimage.median_filter(ndimage.grey_opening(pequeno[..., c], size=(11, 11)), size=9) for c in range(3)], axis=-1)
    num = np.stack([ndimage.gaussian_filter(sin[..., c] * val, 18) for c in range(3)], axis=-1)
    den = ndimage.gaussian_filter(val, 18)[..., None] + 1e-4
    sin = np.where(val[..., None] > 0.5, sin, num / den)
    # Franjas: mucho más suavizado a lo ancho que a lo alto.
    sin = np.stack([ndimage.gaussian_filter(sin[..., c], (3, 26)) for c in range(3)], axis=-1)
    out = np.asarray(Image.fromarray((np.clip(sin, 0, 1) * 255).astype(np.uint8)).resize(TAM, Image.Resampling.LANCZOS), dtype=np.float32) / 255.0
    # Sin costura al envolver la esfera: el último 20 % se funde con el principio (sin espejo).
    w = out.shape[1]
    n = w // 5
    t = np.linspace(0, 1, n)[None, :, None]
    cola = out[:, w - n :] * (1 - t) + out[:, :n] * t
    out = np.concatenate([out[:, : w - n], cola], axis=1)
    out = np.asarray(Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).resize(TAM, Image.Resampling.LANCZOS), dtype=np.float32) / 255.0
    # Contraste: percentiles 1–99,5 comunes a los tres canales, y algo más de saturación.
    lo, hi = np.percentile(out, 1), np.percentile(out, 99.5)
    out = np.clip((out - lo) / (hi - lo), 0, 1)
    gris = out.mean(axis=2, keepdims=True)
    out = np.clip(gris + (out - gris) * 1.35, 0, 1)
    # Polos: hacia el color medio de su fila (evita el pellizco de la proyección).
    h = out.shape[0]
    v = np.abs((np.arange(h) + 0.5) / h * 2 - 1)
    k = np.clip((v - 0.82) / 0.18, 0, 1)[:, None, None]
    return out * (1 - k) + out.mean(axis=1, keepdims=True) * k


def a_tam(arr: np.ndarray, tam: tuple[int, int] = TAM) -> np.ndarray:
    im = Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8)).resize(tam, Image.Resampling.LANCZOS)
    return np.asarray(im, dtype=np.float32) / 255.0


def sin_costura(arr: np.ndarray, fraccion: float = 0.2) -> np.ndarray:
    """El último tramo se funde con el principio: al envolver la esfera no hay costura."""
    w = arr.shape[1]
    n = int(w * fraccion)
    t = np.linspace(0, 1, n)[None, :, None]
    cola = arr[:, w - n :] * (1 - t) + arr[:, :n] * t
    return np.concatenate([arr[:, : w - n], cola], axis=1)


def polos_suaves(arr: np.ndarray, desde: float = 0.82) -> np.ndarray:
    h = arr.shape[0]
    v = np.abs((np.arange(h) + 0.5) / h * 2 - 1)
    k = np.clip((v - desde) / (1 - desde), 0, 1)[:, None, None]
    return arr * (1 - k) + arr.mean(axis=1, keepdims=True) * k


def plano_galactico(cielo: np.ndarray) -> np.ndarray:
    """Franja de ±22° alrededor del plano de la Vía Láctea, estirada a toda la esfera: un gigante en franjas."""
    h = cielo.shape[0]
    franja = cielo[int(h * (0.5 - 22 / 180)) : int(h * (0.5 + 22 / 180))]
    # Franjas: casi todo es el perfil de color por latitud (muy suavizado a lo ancho, con
    # «mode=wrap» para no tener costura); encima, un 30 % de la franja algo menos suavizada.
    perfil = np.stack([ndimage.gaussian_filter(franja[..., c], (0.6, 160), mode="wrap") for c in range(3)], axis=-1)
    detalle = np.stack([ndimage.gaussian_filter(franja[..., c], (0.6, 12), mode="wrap") for c in range(3)], axis=-1)
    return polos_suaves(a_tam(perfil * 0.7 + detalle * 0.3), 0.86)


def burbuja(cielo: np.ndarray) -> np.ndarray:
    """Recorte de las burbujas azules del mapa (gas caliente sobre polvo), envuelto sin costura."""
    h, w = cielo.shape[:2]
    # Zona de las burbujas azules de la derecha del mapa (fracciones del ancho y alto).
    trozo = cielo[int(h * 0.34) : int(h * 0.70), int(w * 0.68) : int(w * 0.94)]
    return polos_suaves(sin_costura(a_tam(trozo), 0.3))


def recorte(cielo: np.ndarray, x0: float, x1: float, y0: float, y1: float, fundido: float = 0.3) -> np.ndarray:
    """Zona del mapa (fracciones de ancho y alto) envuelta sobre la esfera sin costura."""
    h, w = cielo.shape[:2]
    trozo = cielo[int(h * y0) : int(h * y1), int(w * x0) : int(w * x1)]
    return polos_suaves(sin_costura(a_tam(trozo), fundido))


def nebulosa_vela(img: np.ndarray) -> np.ndarray:
    """La nebulosa naranja de la imagen de Vela, sin estrellas, envuelta sobre la esfera."""
    h, w = img.shape[:2]
    trozo = img[int(h * 0.16) : int(h * 0.56), int(w * 0.55) : int(w * 0.82)]
    trozo = a_tam(trozo, (768, 384))
    sin = np.stack([ndimage.median_filter(ndimage.grey_opening(trozo[..., c], size=(7, 7)), size=5) for c in range(3)], axis=-1)
    sin = np.stack([ndimage.gaussian_filter(sin[..., c], (1.5, 5)) for c in range(3)], axis=-1)
    lo, hi = np.percentile(sin, 1), np.percentile(sin, 99.7)
    sin = np.clip((sin - lo) / (hi - lo), 0, 1)
    return polos_suaves(sin_costura(a_tam(sin), 0.3))


def recortar_bordes_negros(im: Image.Image, tolerancia: float = 0.02) -> Image.Image:
    """Recorta las franjas negras de los bordes (uniones del mosaico): se quedan las filas y columnas
    con menos de `tolerancia` de píxeles negros."""
    gris = im.convert("L")
    w, h = gris.size
    px = gris.load()
    negra = lambda x, y: px[x, y] < 8  # noqa: E731
    filas = [sum(negra(x, y) for x in range(0, w, 2)) / (w / 2) for y in range(h)]
    cols = [sum(negra(x, y) for y in range(0, h, 2)) / (h / 2) for x in range(w)]
    y0 = next(y for y in range(h) if filas[y] < tolerancia)
    y1 = next(y for y in range(h - 1, -1, -1) if filas[y] < tolerancia)
    x0 = next(x for x in range(w) if cols[x] < tolerancia)
    x1 = next(x for x in range(w - 1, -1, -1) if cols[x] < tolerancia)
    return im.crop((x0, y0, x1 + 1, y1 + 1))


def vista_previa(nombre: str, destino: Path, ancho: int, recortar: bool = False) -> None:
    im = Image.open(FUENTES / nombre).convert("RGB")
    if recortar:
        im = recortar_bordes_negros(im)
    im = im.resize((ancho, round(im.size[1] * ancho / im.size[0])), Image.Resampling.LANCZOS)
    im.save(destino, "WEBP", quality=78, method=6)
    print(f"{destino.relative_to(RAIZ)}  {im.size[0]}×{im.size[1]}  {destino.stat().st_size / 1024:.1f} KB")


def main() -> None:
    TEXTURAS.mkdir(parents=True, exist_ok=True)
    FICHAS.mkdir(parents=True, exist_ok=True)
    cielo = mollweide_a_equirect(cargar("cielo-spherex.webp"))
    guardar(cielo, TEXTURAS / "cielo-spherex.webp", 82)
    # Más resolución para recortar zonas del mapa sin que se vean borrosas.
    cielo_grande = mollweide_a_equirect(cargar("cielo-spherex.webp"), (2048, 1024))
    guardar(plano_galactico(cielo_grande), TEXTURAS / "plano-galactico.webp", 82)
    guardar(burbuja(cielo_grande), TEXTURAS / "burbuja-spherex.webp", 82)
    # Los dos lazos blancos sobre el centro de la galaxia y los filamentos de polvo del sur del mapa.
    guardar(recorte(cielo_grande, 0.40, 0.62, 0.27, 0.49), TEXTURAS / "lazos-spherex.webp", 82)
    guardar(recorte(cielo_grande, 0.12, 0.40, 0.58, 0.86), TEXTURAS / "filamentos-spherex.webp", 82)
    guardar(nebulosa_vela(cargar("vela-spherex.jpg")), TEXTURAS / "nebulosa-vela.webp", 82)
    guardar(sin_estrellas_en_franjas(cargar("vela-spherex.jpg")), TEXTURAS / "vela-spherex.webp", 82)
    vista_previa("cielo-spherex.webp", FICHAS / "cielo-spherex-original.webp", 480)
    # El mosaico de Vela trae franjas negras en las uniones: en la ficha se ven como cuñas raras.
    vista_previa("vela-spherex.jpg", FICHAS / "vela-spherex-original.webp", 480, recortar=True)


if __name__ == "__main__":
    main()
