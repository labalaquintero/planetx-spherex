#!/usr/bin/env python3
"""Texturas de siete planetas de β a partir de mapas globales reales de NASA/JPL (solo en desarrollo).

Mismo origen y mismo tratamiento que tools/alpha/texturas_nasa.py: JPL Solar System Simulator, mapas de
textura (https://maps.jpl.nasa.gov/tmaps/), mosaicos de Caltech/JPL/USGS con imágenes de Voyager y otras
misiones. Política de uso de JPL: «Unless otherwise noted, images and video on JPL public web sites may be
used for any purpose without prior permission», con el crédito «Courtesy NASA/JPL-Caltech».

Los originales se descargan una vez a --cache (fuera del repo). En src/scene/assets/ solo se escriben
versiones reducidas en WebP, y en src/sectors/beta/referencias/ una vista previa pequeña de cada mapa para
la ficha del HUD. La app nunca pide nada a la red: Vite las empaqueta.

Uso (desde experimental/explorar/, con Pillow en un entorno fuera del repo):
  <venv>/python tools/texturas_nasa_beta.py --cache <carpeta temporal>
Determinista a partir de los mismos originales (se imprime el SHA-256 de cada uno).
"""

from __future__ import annotations

import argparse
import hashlib
import urllib.request
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parents[1]
TEXTURAS = RAIZ / "src" / "scene" / "assets"
FICHAS = RAIZ / "src" / "sectors" / "beta" / "referencias"
BASE = "https://maps.jpl.nasa.gov/tmaps/pix/"
UA = {"User-Agent": "Mozilla/5.0 (explorar-dev)"}

# (archivo de JPL, salida, qué es)
MAPAS = [
    ("nep0fds1.jpg", "neptuno-voyager", "Neptuno, Voyager 2"),
    ("sat2vss2.jpg", "encelado-voyager", "Encélado, Voyager"),
    ("sat8vss2.jpg", "japeto-voyager", "Japeto, Voyager"),
    ("jup4vss2.jpg", "calisto-voyager", "Calisto, Voyager"),
    ("sat3vss2.jpg", "tetis-voyager", "Tetis, Voyager"),
    ("sat1vss2.jpg", "mimas-voyager", "Mimas, Voyager"),
    ("ear0xuu2.jpg", "tierra-relieve", "Tierra, relieve en color"),
]
# Descartados por cubrir poco (huecos negros o lisos de las sondas): Tritón, Miranda y las demás lunas de
# Urano, Mercurio (media esfera vacía) y Titán (color plano).


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
        print(f"{salida:18} {out.stat().st_size / 1024:6.1f} KB  ficha {out_prev.stat().st_size / 1024:5.1f} KB  ← {origen} {im.size} sha256 {sha}…  ({que})")


if __name__ == "__main__":
    main()
