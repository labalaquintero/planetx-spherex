"""Verificador determinista de integridad para manifiestos JSON preparados (F01).

Rol: César (Calidad de datos y auditoría QA — `cesar/f01-calidad-datos`).
Aplica exactamente las mismas reglas de integridad que `consultas_integridad.sql`
sobre archivos manifiesto (`{"entries": [...]}`) o payloads individuales del
contrato JSON v1, sin modificar archivos ni requerir base de datos activa.

Uso desde línea de comandos:
    python docs/qa/datos/verificar_manifiesto.py ruta/al/manifest.json [--products-dir ruta/products]
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

ALLOWED_STATUSES = {"ready", "insufficient", "no_coverage"}
ALLOWED_INSUFFICIENT_REASONS = {
    "single_epoch",
    "no_common_band",
    "no_usable_frames",
    "search_limit_reached",
}
ALLOWED_RELEASES = {"dr1", "qr3", "fixture"}
ALLOWED_MODES = {"prepared", "fixture", "live"}


def _is_finite_number(val: Any) -> bool:
    return isinstance(val, (int, float)) and not isinstance(val, bool) and math.isfinite(float(val))


def _parse_utc_iso(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip().endswith("Z"):
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo is not None else None


def verify_manifest_data(
    data: dict[str, Any],
    *,
    products_dir: Path | None = None,
    require_png_files: bool = False,
) -> list[str]:
    """Devuelve una lista de errores de integridad detectados (vacía si es íntegro)."""
    errors: list[str] = []

    if not isinstance(data, dict):
        return ["El documento raíz debe ser un objeto JSON."]

    # Acepta tanto un manifiesto {"entries": [...]} como un payload individual v1
    if "entries" in data:
        entries = data.get("entries")
        if not isinstance(entries, list):
            return ["El campo 'entries' del manifiesto debe ser una lista."]
    else:
        entries = [data]

    seen_region_keys: set[tuple[float, float, float, str]] = set()
    seen_global_frame_ids: set[str] = set()

    for idx, entry in enumerate(entries):
        prefix = f"entries[{idx}]"
        if not isinstance(entry, dict):
            errors.append(f"{prefix}: la entrada no es un objeto JSON.")
            continue

        if entry.get("schema_version") != "1":
            errors.append(f"{prefix}: schema_version debe ser '1' (recibido: {entry.get('schema_version')!r}).")

        mode = entry.get("mode")
        if mode not in ALLOWED_MODES:
            errors.append(f"{prefix}: mode inválido ({mode!r}).")

        status = entry.get("status")
        reason = entry.get("reason")
        if status not in ALLOWED_STATUSES:
            errors.append(f"{prefix}: status inválido ({status!r}).")

        if _parse_utc_iso(entry.get("checked_at")) is None:
            errors.append(f"{prefix}: checked_at no es una fecha UTC ISO-8601 terminada en 'Z'.")

        science_version = entry.get("science_version")
        if not isinstance(science_version, str) or not science_version.strip():
            errors.append(f"{prefix}: science_version ausente o vacío.")
            sv_norm = ""
        else:
            sv_norm = science_version.strip()

        # 1. Validación de rangos ICRS y clave única de región
        query = entry.get("query")
        if not isinstance(query, dict):
            errors.append(f"{prefix}: bloque 'query' ausente o inválido.")
        else:
            if query.get("frame") != "ICRS":
                errors.append(f"{prefix}: query.frame debe ser 'ICRS'.")
            ra = query.get("ra_deg")
            dec = query.get("dec_deg")
            fov = query.get("fov_deg")
            if not _is_finite_number(ra) or not (0.0 <= float(ra) < 360.0):
                errors.append(f"{prefix}: query.ra_deg fuera de rango ICRS [0, 360): {ra!r}.")
            if not _is_finite_number(dec) or not (-90.0 <= float(dec) <= 90.0):
                errors.append(f"{prefix}: query.dec_deg fuera de rango ICRS [-90, 90]: {dec!r}.")
            if not _is_finite_number(fov) or float(fov) <= 0.0:
                errors.append(f"{prefix}: query.fov_deg debe ser > 0: {fov!r}.")

            if _is_finite_number(ra) and _is_finite_number(dec) and _is_finite_number(fov) and sv_norm:
                rkey = (float(ra), float(dec), float(fov), sv_norm)
                if rkey in seen_region_keys:
                    errors.append(f"{prefix}: región/versión duplicada en manifiesto: {rkey}.")
                seen_region_keys.add(rkey)

        frames = entry.get("frames")
        if not isinstance(frames, list):
            errors.append(f"{prefix}: 'frames' debe ser una lista.")
            continue

        # 2. Integridad referencial y reglas por estado
        if status == "ready":
            if reason is not None:
                errors.append(f"{prefix}: status='ready' requiere reason=null.")
            if not (2 <= len(frames) <= 6):
                errors.append(f"{prefix}: status='ready' requiere entre 2 y 6 fotogramas (tiene {len(frames)}).")
        elif status == "insufficient":
            if reason not in ALLOWED_INSUFFICIENT_REASONS:
                errors.append(f"{prefix}: reason inválido para 'insufficient': {reason!r}.")
            if len(frames) > 1:
                errors.append(f"{prefix}: status='insufficient' admite máximo 1 fotograma (tiene {len(frames)}).")
        elif status == "no_coverage":
            if reason != "no_observations":
                errors.append(f"{prefix}: status='no_coverage' requiere reason='no_observations'.")
            if len(frames) != 0:
                errors.append(f"{prefix}: status='no_coverage' requiere frames=[].")

        # 3. Consistencia espectral (band)
        band = entry.get("band")
        if len(frames) > 0:
            if not isinstance(band, dict):
                errors.append(f"{prefix}: 'band' no puede ser null cuando existen fotogramas.")
            else:
                c_um = band.get("center_um")
                t_um = band.get("tolerance_um")
                if not _is_finite_number(c_um) or float(c_um) <= 0.0:
                    errors.append(f"{prefix}: band.center_um debe ser > 0 ({c_um!r}).")
                if not _is_finite_number(t_um) or float(t_um) <= 0.0:
                    errors.append(f"{prefix}: band.tolerance_um debe ser > 0 ({t_um!r}).")
        else:
            if band is not None:
                errors.append(f"{prefix}: 'band' debe ser null cuando frames está vacío.")

        # 4. Duplicados de observation_id / frame_id y orden cronológico estricto
        seen_obs_ids: set[str] = set()
        prev_dt: datetime | None = None

        for f_idx, frame in enumerate(frames):
            f_prefix = f"{prefix}.frames[{f_idx}]"
            if not isinstance(frame, dict):
                errors.append(f"{f_prefix}: el fotograma no es un objeto.")
                continue

            fid = frame.get("id")
            if not isinstance(fid, str) or not fid.strip() or "/" in fid or "\\" in fid or ".." in fid:
                errors.append(f"{f_prefix}: 'id' de fotograma inválido o inseguro ({fid!r}).")
            else:
                if fid in seen_global_frame_ids:
                    errors.append(f"{f_prefix}: frame_id duplicado ({fid!r}).")
                seen_global_frame_ids.add(fid)

                expected_url = f"/api/v1/images/{fid}"
                if frame.get("image_url") != expected_url:
                    errors.append(
                        f"{f_prefix}: image_url inválido ({frame.get('image_url')!r}, esperado {expected_url!r})."
                    )

                if require_png_files and products_dir is not None:
                    png_path = products_dir / f"{fid}.png"
                    if not png_path.is_file() or png_path.stat().st_size == 0:
                        errors.append(f"{f_prefix}: archivo PNG derivado faltante o vacío ({png_path}).")

            obs_id = frame.get("observation_id")
            if not isinstance(obs_id, str) or not obs_id.strip():
                errors.append(f"{f_prefix}: observation_id ausente o vacío.")
            else:
                if obs_id in seen_obs_ids:
                    errors.append(f"{f_prefix}: observation_id duplicado en la misma secuencia ({obs_id!r}).")
                seen_obs_ids.add(obs_id)

            if frame.get("release") not in ALLOWED_RELEASES:
                errors.append(f"{f_prefix}: release inválido ({frame.get('release')!r}).")

            obs_dt = _parse_utc_iso(frame.get("observed_at"))
            if obs_dt is None:
                errors.append(f"{f_prefix}: observed_at inválido ({frame.get('observed_at')!r}).")
            else:
                if prev_dt is not None and obs_dt <= prev_dt:
                    errors.append(
                        f"{f_prefix}: violación de orden cronológico estricto ({frame.get('observed_at')!r})."
                    )
                prev_dt = obs_dt

    return errors


def verify_manifest_file(
    manifest_path: str | Path,
    *,
    products_dir: str | Path | None = None,
    require_png_files: bool = False,
) -> list[str]:
    path = Path(manifest_path)
    if not path.is_file():
        return [f"No existe el archivo: {path}"]
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return [f"Error al parsear JSON en {path}: {exc}"]

    resolved_products = Path(products_dir) if products_dir is not None else None
    return verify_manifest_data(
        payload,
        products_dir=resolved_products,
        require_png_files=require_png_files,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Verifica la integridad de un manifiesto JSON o fixture del contrato v1."
    )
    parser.add_argument("manifest", nargs="+", help="Ruta(s) a archivo(s) JSON a verificar.")
    parser.add_argument(
        "--products-dir",
        default=None,
        help="Directorio opcional donde verificar la existencia de <frame_id>.png.",
    )
    parser.add_argument(
        "--require-png",
        action="store_true",
        help="Exigir que cada <frame_id>.png exista y no esté vacío en --products-dir.",
    )
    args = parser.parse_args(argv)

    total_errors = 0
    for target in args.manifest:
        errs = verify_manifest_file(
            target,
            products_dir=args.products_dir,
            require_png_files=args.require_png,
        )
        if errs:
            total_errors += len(errs)
            print(f"[FALLO] {target}: {len(errs)} error(es)")
            for e in errs:
                print(f"  - {e}")
        else:
            print(f"[OK] {target}: 0 errores de integridad")

    return 1 if total_errors > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
