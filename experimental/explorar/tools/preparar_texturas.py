#!/usr/bin/env python3
"""Descarga (solo en desarrollo) y reduce las texturas de referencia que usa la escena.

Fuentes con licencia verificada en su propia página (ver ATTRIBUTIONS.md):
  - Solar System Scope, «Distributed under Attribution 4.0 International license» (CC BY 4.0)
  - NASA Scientific Visualization Studio, CGI Moon Kit (ID 4720): dominio público («All of our
    content is in the public domain (unless otherwise noted)»), con crédito solicitado.

Uso (desde experimental/explorar/):
  /tmp/explorar-venv/bin/python tools/preparar_texturas.py --cache /tmp/explorar-ref

Los originales quedan en --cache (fuera del repo); en src/scene/assets/ solo se escriben las
versiones reducidas en WebP. La app nunca las pide a la red: Vite las empaqueta.
"""

from __future__ import annotations

import argparse
import hashlib
import urllib.request
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "src" / "scene" / "assets"
UA = {"User-Agent": "Mozilla/5.0 (explorar-dev)"}

SSS = "https://www.solarsystemscope.com/textures/download/"
SVS = "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/"

# (archivo de origen, url, salida, tamaño, modo, calidad)
# 2048 px de color y 1024 de relieve: de cerca (escaneo, planetas grandes) las de 1024/512 se veían blandas
# y el relieve en escalones.
RECURSOS = [
    ("2k_saturn.jpg", SSS + "2k_saturn.jpg", "bandas-saturno.webp", (2048, 1024), "RGB", 80),
    ("2k_saturn_ring_alpha.png", SSS + "2k_saturn_ring_alpha.png", "anillo-saturno.webp", (1024, 64), "RGBA", 90),
    ("lroc_color_poles_2k.tif", SVS + "lroc_color_poles_2k.tif", "luna-color.webp", (2048, 1024), "RGB", 80),
    ("ldem_3_8bit.jpg", SVS + "ldem_3_8bit.jpg", "luna-relieve.webp", (1024, 512), "L", 85),
]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cache", type=Path, default=Path("/tmp/explorar-ref"))
    args = ap.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    DESTINO.mkdir(parents=True, exist_ok=True)
    total = 0
    for origen, url, salida, tam, modo, q in RECURSOS:
        f = args.cache / origen
        if not f.exists():
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
                f.write_bytes(r.read())
        sha = hashlib.sha256(f.read_bytes()).hexdigest()[:16]
        im = Image.open(f).convert(modo).resize(tam, Image.Resampling.LANCZOS)
        out = DESTINO / salida
        im.save(out, "WEBP", quality=q, method=6, lossless=False)
        total += out.stat().st_size
        print(f"{salida:22} {out.stat().st_size / 1024:6.1f} KB  ← {origen} ({f.stat().st_size / 1024:.0f} KB, sha256 {sha}…)")
    print(f"total empaquetado: {total / 1024:.1f} KB")


if __name__ == "__main__":
    main()
