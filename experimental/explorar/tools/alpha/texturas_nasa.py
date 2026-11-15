#!/usr/bin/env python3
"""Texturas de los planetas de α a partir de mapas globales reales de NASA/JPL (solo en desarrollo).

Fuente: JPL Solar System Simulator, mapas de textura (https://maps.jpl.nasa.gov/tmaps/), mosaicos
de Caltech/JPL/USGS con imágenes de Viking, Voyager, Galileo y Magellan. Política de uso de JPL:
«Unless otherwise noted, images and video on JPL public web sites may be used for any purpose
without prior permission», con el crédito «Courtesy NASA/JPL-Caltech».

Los originales se descargan una vez a --cache (fuera del repo). En src/scene/assets/ solo se
escriben versiones reducidas en WebP, y en src/sectors/alpha/referencias/ una vista previa pequeña
de cada mapa para la ficha del HUD. La app nunca pide nada a la red: Vite las empaqueta.

Uso (desde experimental/explorar/, con Pillow en un entorno fuera del repo):
  <venv>/python tools/alpha/texturas_nasa.py --cache <carpeta temporal>
Determinista a partir de los mismos originales (se imprime el SHA-256 de cada uno).
"""

from __future__ import annotations

import argparse
import hashlib
import urllib.request
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parents[2]
TEXTURAS = RAIZ / "src" / "scene" / "assets"
FICHAS = RAIZ / "src" / "sectors" / "alpha" / "referencias"
BASE = "https://maps.jpl.nasa.gov/tmaps/pix/"
UA = {"User-Agent": "Mozilla/5.0 (explorar-dev)"}

# (archivo de JPL, salida, qué es)
MAPAS = [
    ("mar0kuu2.jpg", "marte-viking", "Marte, color, Viking (USGS)"),
    ("jup1vss2.jpg", "io-galileo", "Ío, Voyager con color de Galileo"),
    ("jup2vss2.jpg", "europa-voyager", "Europa, Voyager"),
    ("jup3vss2.jpg", "ganimedes-voyager", "Ganímedes, Voyager"),
    ("mar1kuu2.jpg", "fobos-viking", "Fobos, Viking (USGS), escala de grises"),
    ("ven0aaa2.jpg", "venus-magellan", "Venus, radar de Magellan"),
]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cache", type=Path, required=True)
    args = ap.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    TEXTURAS.mkdir(parents=True, exist_ok=True)
    FICHAS.mkdir(parents=True, exist_ok=True)
    for origen, salida, que in MAPAS:
        f = args.cache / origen
        if not f.exists():
            with urllib.request.urlopen(urllib.request.Request(BASE + origen, headers=UA), timeout=120) as r:
                f.write_bytes(r.read())
        sha = hashlib.sha256(f.read_bytes()).hexdigest()[:16]
        im = Image.open(f).convert("RGB")
        tex = im.resize((1024, 512), Image.Resampling.LANCZOS)
        out = TEXTURAS / f"{salida}.webp"
        tex.save(out, "WEBP", quality=82, method=6)
        prev = im.resize((360, 180), Image.Resampling.LANCZOS)
        out_prev = FICHAS / f"{salida}-original.webp"
        prev.save(out_prev, "WEBP", quality=80, method=6)
        print(f"{salida:20} {out.stat().st_size / 1024:6.1f} KB  ficha {out_prev.stat().st_size / 1024:5.1f} KB  ← {origen} {im.size} sha256 {sha}…  ({que})")


if __name__ == "__main__":
    main()
