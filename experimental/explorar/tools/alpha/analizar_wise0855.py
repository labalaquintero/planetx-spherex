#!/usr/bin/env python3
"""Mide los dos recortes reales de WISE 0855 (SPHEREx) y escribe el campo de referencia del sector α.

Entrada (solo lectura):  docs/referencias/wise0855/manifest.json y sus dos PNG (64 × 64, LA).
Salida (versionada):     docs/referencias/alpha/campo-wise0855.json

Qué mide, sobre los píxeles válidos (alfa > 0, la máscara común de la regla científica v1):
  - Fondo de cada época: mediana, dispersión robusta (MAD × 1,4826), percentiles y longitud de
    correlación (desfase en el que la autocorrelación del fondo cae por debajo de 0,5).
  - Fuentes: se detectan sobre la media de las dos épocas suavizada (gaussiana σ = 1 px), por encima
    de mediana + 3 σ y con al menos 3 píxeles conectados. De cada una: centroide ponderado por el
    flujo, pico, flujo integrado sobre el fondo, área y radio equivalente, y su flujo en cada época.
  - Cambio entre épocas: correlación de los píxeles válidos, dispersión de la diferencia y, por
    fuente, cociente de flujos y desplazamiento del centroide.

Coordenadas normalizadas como en pantalla: u = x / 64 (a la derecha), v = y / 64 (hacia abajo),
medidas en el centro del píxel. Los PNG ya están en una rejilla TAN con el norte arriba y el este a
la izquierda. Determinista: sin aleatoriedad; los números se redondean para que el JSON sea estable.

Uso (entorno fuera del repo):
  python -m venv <tmp>/alphavenv
  <tmp>/alphavenv/Scripts/python -m pip install numpy==2.5.4 pillow==13.0.0 scipy==1.18.1
  <tmp>/alphavenv/Scripts/python tools/alpha/analizar_wise0855.py        # desde experimental/explorar
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]  # experimental/explorar
REF = ROOT / "docs" / "referencias" / "wise0855"
OUT = ROOT / "docs" / "referencias" / "alpha" / "campo-wise0855.json"

SMOOTH_SIGMA_PX = 1.0
DETECT_SIGMA = 3.0
MIN_PIXELS = 3
MAX_SOURCES = 24


def r(x: float, n: int = 4) -> float:
    return float(round(float(x), n))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path: Path) -> tuple[np.ndarray, np.ndarray]:
    a = np.asarray(Image.open(path).convert("LA"), dtype=np.float64)
    return a[..., 0] / 255.0, a[..., 1] > 0


def robust(values: np.ndarray) -> tuple[float, float]:
    med = float(np.median(values))
    return med, float(np.median(np.abs(values - med)) * 1.4826)


def correlation_length(img: np.ndarray, valid: np.ndarray, med: float, clip: float) -> float:
    """Desfase (px) en el que la autocorrelación del fondo (fuentes recortadas) baja de 0,5."""
    x = np.where(valid, np.clip(img, None, clip) - med, 0.0)
    w = valid.astype(np.float64)
    var = float((x * x).sum() / w.sum())
    for lag in range(1, 16):
        num = (x[:, lag:] * x[:, :-lag]).sum() + (x[lag:, :] * x[:-lag, :]).sum()
        den = (w[:, lag:] * w[:, :-lag]).sum() + (w[lag:, :] * w[:-lag, :]).sum()
        if num / den / var < 0.5:
            return float(lag)
    return 16.0


def background(img: np.ndarray, valid: np.ndarray) -> dict:
    v = img[valid]
    med, sig = robust(v)
    p = np.percentile(v, [1, 5, 25, 50, 75, 95, 99])
    return {
        "mediana": r(med),
        "sigma_robusta": r(sig),
        "media": r(v.mean()),
        "desviacion": r(v.std()),
        "percentiles": {k: r(x) for k, x in zip(["p1", "p5", "p25", "p50", "p75", "p95", "p99"], p)},
        "fraccion_sobre_3sigma": r((v > med + 3 * sig).mean()),
        "longitud_correlacion_px": correlation_length(img, valid, med, med + 3 * sig),
    }


def main() -> None:
    manifest_path = REF / "manifest.json"
    entry = json.loads(manifest_path.read_text(encoding="utf-8"))["entries"][0]
    frames = entry["frames"]
    epochs = []
    for f in frames:
        path = REF / "products" / f"{f['id']}.png"
        img, valid = load(path)
        epochs.append({"frame": f, "path": path, "img": img, "valid": valid})

    h, w = epochs[0]["img"].shape
    valid = epochs[0]["valid"] & epochs[1]["valid"]
    mean = (epochs[0]["img"] + epochs[1]["img"]) / 2
    # Suavizado normalizado por la máscara para que los huecos no oscurezcan los bordes.
    num = ndimage.gaussian_filter(np.where(valid, mean, 0.0), SMOOTH_SIGMA_PX)
    den = ndimage.gaussian_filter(valid.astype(np.float64), SMOOTH_SIGMA_PX)
    smooth = np.where(valid, num / np.maximum(den, 1e-6), 0.0)

    med, sig = robust(smooth[valid])
    mask = valid & (smooth > med + DETECT_SIGMA * sig)
    labels, n = ndimage.label(mask, structure=np.ones((3, 3)))

    bgs = [robust(e["img"][valid])[0] for e in epochs]
    bg_mean = robust(mean[valid])[0]
    yy, xx = np.mgrid[0:h, 0:w]
    sources = []
    for lab in range(1, n + 1):
        px = labels == lab
        area = int(px.sum())
        if area < MIN_PIXELS:
            continue
        flux_px = np.clip(mean[px] - bg_mean, 0, None)
        total = float(flux_px.sum())
        if total <= 0:
            continue
        cx = float((xx[px] * flux_px).sum() / total)
        cy = float((yy[px] * flux_px).sum() / total)
        per_epoch = []
        for e, bg in zip(epochs, bgs):
            fp = np.clip(e["img"][px] - bg, 0, None)
            t = float(fp.sum())
            ex = float((xx[px] * fp).sum() / t) if t > 0 else cx
            ey = float((yy[px] * fp).sum() / t) if t > 0 else cy
            per_epoch.append({"flujo": r(t), "pico": r(e["img"][px].max()), "u": r((ex + 0.5) / w), "v": r((ey + 0.5) / h)})
        ys, xs = np.nonzero(px)
        sources.append({
            "u": r((cx + 0.5) / w),
            "v": r((cy + 0.5) / h),
            "x_px": r(cx, 2),
            "y_px": r(cy, 2),
            "pico": r(mean[px].max()),
            "flujo": r(total),
            "area_px": area,
            "radio_equivalente_px": r(np.sqrt(area / np.pi), 3),
            "toca_borde_o_mascara": bool(
                xs.min() == 0 or ys.min() == 0 or xs.max() == w - 1 or ys.max() == h - 1
                or (ndimage.binary_dilation(px) & ~valid).any()
            ),
            "epocas": per_epoch,
            "cociente_flujo_e2_e1": r(per_epoch[1]["flujo"] / per_epoch[0]["flujo"], 3) if per_epoch[0]["flujo"] > 0 else None,
            "desplazamiento_px": r(np.hypot((per_epoch[1]["u"] - per_epoch[0]["u"]) * w, (per_epoch[1]["v"] - per_epoch[0]["v"]) * h), 3),
        })

    sources.sort(key=lambda s: (-s["flujo"], s["u"], s["v"]))
    candidates = len(sources)
    sources = sources[:MAX_SOURCES]
    max_flux = sources[0]["flujo"] if sources else 1.0
    for i, s in enumerate(sources, 1):
        s["id"] = f"f{i:02d}"
        s["brillo_relativo"] = r(s["flujo"] / max_flux)
    sources = [{"id": s.pop("id"), "brillo_relativo": s.pop("brillo_relativo"), **s} for s in sources]

    a, b = epochs[0]["img"][valid], epochs[1]["img"][valid]
    diff = b - bgs[1] - (a - bgs[0])
    cover = valid.mean()

    out = {
        "version": 1,
        "generado_por": "tools/alpha/analizar_wise0855.py",
        "aviso": "Medidas de dos recortes reales de SPHEREx (64 × 64). Sirven de guía de composición del sector α; "
                 "la escena es una representación ilustrativa.",
        "fuente": {
            "manifiesto": "docs/referencias/wise0855/manifest.json",
            "manifiesto_sha256": sha256(manifest_path),
            "centro_icrs": {"ra_deg": entry["query"]["ra_deg"], "dec_deg": entry["query"]["dec_deg"]},
            "campo_deg": entry["query"]["fov_deg"],
            "banda_um": {"centro": r(entry["band"]["center_um"], 6), "tolerancia": r(entry["band"]["tolerance_um"], 6)},
            "credito": "Courtesy NASA/JPL-Caltech · SPHEREx, NASA/IPAC IRSA",
            "epocas": [
                {
                    "observation_id": e["frame"]["observation_id"],
                    "observed_at": e["frame"]["observed_at"],
                    "png": f"products/{e['frame']['id']}.png",
                    "png_sha256": sha256(e["path"]),
                }
                for e in epochs
            ],
        },
        "rejilla": {"ancho_px": w, "alto_px": h, "orientacion": "norte arriba, este a la izquierda",
                     "coordenadas": "u = x/ancho (derecha), v = y/alto (abajo), centro de píxel"},
        "mascara": {"pixeles_validos": int(valid.sum()), "fraccion_valida": r(cover)},
        "deteccion": {"suavizado_sigma_px": SMOOTH_SIGMA_PX, "umbral_sigma": DETECT_SIGMA, "min_pixeles": MIN_PIXELS,
                      "max_fuentes": MAX_SOURCES, "candidatas": candidates, "fuentes_conservadas": len(sources)},
        "fondo": [background(e["img"], valid) for e in epochs],
        "cambio_entre_epocas": {
            "dias": r(
                (np.datetime64(epochs[1]["frame"]["observed_at"].rstrip("Z")) - np.datetime64(epochs[0]["frame"]["observed_at"].rstrip("Z")))
                / np.timedelta64(1, "s") / 86400, 2),
            "correlacion_pixeles": r(np.corrcoef(a, b)[0, 1]),
            "diferencia_sigma_robusta": r(robust(diff)[1]),
            "diferencia_media": r(diff.mean()),
            "fuentes_estables_cociente_0_5_a_2": sum(1 for s in sources if s["cociente_flujo_e2_e1"] and 0.5 <= s["cociente_flujo_e2_e1"] <= 2),
            "nota": "El contraste de ambos PNG es compartido (percentiles 1–99), así que el cambio de mediana del fondo "
                    "refleja el fondo de cada exposición, no un cambio físico del campo.",
        },
        "fuentes": sources,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"{OUT.relative_to(ROOT)}: {len(sources)} fuentes; fondo e1 {out['fondo'][0]['mediana']}, e2 {out['fondo'][1]['mediana']}")


if __name__ == "__main__":
    main()
