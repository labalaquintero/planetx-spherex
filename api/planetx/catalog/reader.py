from __future__ import annotations

import json
import math
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from .exceptions import (
    InvalidCatalogQueryError,
    ManifestCorruptError,
    ManifestNotFoundError,
    MissingProductError,
)

ALLOWED_STATUSES = {"ready", "insufficient", "no_coverage"}
INSUFFICIENT_REASONS = {
    "single_epoch",
    "no_common_band",
    "no_usable_frames",
    "search_limit_reached",
}
ALLOWED_RELEASES = {"dr1", "qr3", "fixture"}

# Debe coincidir con FRAME_ID_RE de planetx.http.images para que todo frame_id
# emitido por get_prepared() sea servible por /api/v1/images/<frame_id>.
FRAME_ID_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}\Z", re.ASCII)


def _validate_finite_number(value: Any, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise InvalidCatalogQueryError(f"El parámetro '{name}' debe ser numérico.")
    num = float(value)
    if not math.isfinite(num):
        raise InvalidCatalogQueryError(f"El parámetro '{name}' debe ser finito.")
    return num


def _parse_utc_iso(timestamp_str: Any, field_name: str) -> datetime:
    if not isinstance(timestamp_str, str) or not timestamp_str.strip():
        raise ManifestCorruptError(f"Campo temporal '{field_name}' ausente o vacío.")
    normalized = timestamp_str.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ManifestCorruptError(
            f"Formato ISO-8601 inválido en '{field_name}': {timestamp_str}"
        ) from exc
    if parsed.tzinfo is None:
        raise ManifestCorruptError(
            f"El timestamp '{field_name}' debe incluir zona horaria UTC: {timestamp_str}"
        )
    return parsed


def _validate_safe_frame_id(frame_id: Any) -> str:
    if not isinstance(frame_id, str) or not frame_id.strip():
        raise ManifestCorruptError("Cada fotograma debe tener un 'id' no vacío.")
    if not FRAME_ID_RE.match(frame_id):
        raise ManifestCorruptError(
            f"Identificador de fotograma inválido: '{frame_id}'. "
            f"Debe cumplir ^[A-Za-z0-9][A-Za-z0-9._-]{{0,127}}$"
        )
    return frame_id


def _validate_and_normalize_entry(
    entry: dict[str, Any],
    products_dir: Path,
) -> dict[str, Any]:
    if entry.get("schema_version") != "1":
        raise ManifestCorruptError("schema_version debe ser exactamente '1'.")
    if entry.get("mode") != "prepared":
        raise ManifestCorruptError("El manifiesto preparado debe declarar mode='prepared'.")

    status = entry.get("status")
    reason = entry.get("reason")
    if status not in ALLOWED_STATUSES:
        raise ManifestCorruptError(f"Estado no permitido en manifiesto: {status}")
    if status == "ready" and reason is not None:
        raise ManifestCorruptError("Un registro 'ready' debe tener reason=null.")
    if status == "insufficient" and reason not in INSUFFICIENT_REASONS:
        raise ManifestCorruptError(f"Razón inválida para 'insufficient': {reason}")
    if status == "no_coverage" and reason != "no_observations":
        raise ManifestCorruptError("Un registro 'no_coverage' requiere reason='no_observations'.")

    query = entry.get("query")
    if not isinstance(query, dict) or query.get("frame") != "ICRS":
        raise ManifestCorruptError("El bloque 'query' debe usar frame='ICRS'.")

    ra_deg = _validate_finite_number(query.get("ra_deg"), "query.ra_deg")
    dec_deg = _validate_finite_number(query.get("dec_deg"), "query.dec_deg")
    fov_deg = _validate_finite_number(query.get("fov_deg"), "query.fov_deg")

    checked_at = entry.get("checked_at")
    _parse_utc_iso(checked_at, "checked_at")

    science_version = entry.get("science_version")
    if not isinstance(science_version, str) or not science_version.strip():
        raise ManifestCorruptError("science_version debe ser una cadena no vacía.")

    warnings = entry.get("warnings", [])
    if not isinstance(warnings, list) or not all(isinstance(w, str) for w in warnings):
        raise ManifestCorruptError("'warnings' debe ser una lista de cadenas.")

    raw_frames = entry.get("frames")
    if not isinstance(raw_frames, list):
        raise ManifestCorruptError("'frames' debe ser una lista.")

    if status == "ready" and not (2 <= len(raw_frames) <= 6):
        raise ManifestCorruptError("Un registro 'ready' debe contener entre 2 y 6 fotogramas.")
    if status == "insufficient" and len(raw_frames) > 1:
        raise ManifestCorruptError("Un registro 'insufficient' admite como máximo 1 fotograma.")
    if status == "no_coverage" and len(raw_frames) != 0:
        raise ManifestCorruptError("Un registro 'no_coverage' debe tener frames vacío.")

    band = entry.get("band")
    if len(raw_frames) > 0:
        if not isinstance(band, dict):
            raise ManifestCorruptError("Se requiere objeto 'band' cuando existen fotogramas.")
        center_um = _validate_finite_number(band.get("center_um"), "band.center_um")
        tolerance_um = _validate_finite_number(band.get("tolerance_um"), "band.tolerance_um")
        if center_um <= 0 or tolerance_um <= 0:
            raise ManifestCorruptError("Los parámetros de 'band' deben ser positivos.")
        normalized_band: dict[str, float] | None = {
            "center_um": center_um,
            "tolerance_um": tolerance_um,
        }
    else:
        normalized_band = None

    seen_frame_ids: set[str] = set()
    seen_obs_ids: set[str] = set()
    prev_observed_at: datetime | None = None
    normalized_frames: list[dict[str, Any]] = []

    for frame in raw_frames:
        if not isinstance(frame, dict):
            raise ManifestCorruptError("Cada elemento de 'frames' debe ser un objeto.")

        frame_id = _validate_safe_frame_id(frame.get("id"))
        if frame_id in seen_frame_ids:
            raise ManifestCorruptError(f"ID de fotograma duplicado en secuencia: {frame_id}")
        seen_frame_ids.add(frame_id)

        obs_id = frame.get("observation_id")
        if not isinstance(obs_id, str) or not obs_id.strip():
            raise ManifestCorruptError(f"observation_id inválido en frame '{frame_id}'.")
        if obs_id in seen_obs_ids:
            raise ManifestCorruptError(
                f"Observación duplicada en secuencia ('{obs_id}'): no repetir misma visita."
            )
        seen_obs_ids.add(obs_id)

        observed_dt = _parse_utc_iso(frame.get("observed_at"), f"frames[{frame_id}].observed_at")
        if prev_observed_at is not None and observed_dt <= prev_observed_at:
            raise ManifestCorruptError(
                f"Los fotogramas no están en orden cronológico estricto en '{frame_id}'."
            )
        prev_observed_at = observed_dt

        release = frame.get("release")
        if release not in ALLOWED_RELEASES:
            raise ManifestCorruptError(f"Release no válido en frame '{frame_id}': {release}")

        source_url = frame.get("source_url")
        if source_url is not None and not isinstance(source_url, str):
            raise ManifestCorruptError(f"source_url inválido en frame '{frame_id}'.")

        expected_image_url = f"/api/v1/images/{frame_id}"
        if frame.get("image_url") != expected_image_url:
            raise ManifestCorruptError(
                f"image_url debe ser '{expected_image_url}', recibido '{frame.get('image_url')}'."
            )

        quality_flags = frame.get("quality_flags", [])
        if not isinstance(quality_flags, list) or not all(
            isinstance(flag, str) for flag in quality_flags
        ):
            raise ManifestCorruptError(f"quality_flags inválido en frame '{frame_id}'.")

        artifact_path = products_dir / f"{frame_id}.png"
        if not artifact_path.is_file() or artifact_path.stat().st_size == 0:
            raise MissingProductError(
                f"Producto PNG faltante o vacío para '{frame_id}': {artifact_path}"
            )

        normalized_frames.append(
            {
                "id": frame_id,
                "observed_at": frame["observed_at"],
                "release": release,
                "observation_id": obs_id,
                "source_url": source_url,
                "image_url": expected_image_url,
                "quality_flags": list(quality_flags),
            }
        )

    return {
        "schema_version": "1",
        "status": status,
        "reason": reason,
        "mode": "prepared",
        "query": {
            "ra_deg": ra_deg,
            "dec_deg": dec_deg,
            "frame": "ICRS",
            "fov_deg": fov_deg,
        },
        "band": normalized_band,
        "checked_at": checked_at,
        "science_version": science_version,
        "warnings": list(warnings),
        "frames": normalized_frames,
    }


def get_prepared(
    ra_deg: float,
    dec_deg: float,
    fov_deg: float = 0.1,
    science_version: str = "v1",
    *,
    version: str | None = None,
    manifest_path: str | Path | None = None,
    products_dir: str | Path | None = None,
) -> dict[str, Any] | None:
    """Recupera un payload 'prepared' exacto por centro, campo y versión científica.

    Devuelve None si no existe entrada activa para el par numérico exacto.
    Lanza CatalogIntegrityError si el manifiesto está corrupto o falta un PNG derivado.
    """
    ra = _validate_finite_number(ra_deg, "ra_deg")
    dec = _validate_finite_number(dec_deg, "dec_deg")
    fov = _validate_finite_number(fov_deg, "fov_deg")

    if not (0.0 <= ra < 360.0):
        raise InvalidCatalogQueryError("ra_deg debe estar en el rango [0, 360).")
    if not (-90.0 <= dec <= 90.0):
        raise InvalidCatalogQueryError("dec_deg debe estar en el rango [-90, 90].")
    if fov <= 0.0:
        raise InvalidCatalogQueryError("fov_deg debe ser mayor que 0.")

    raw_version = version if version is not None else science_version
    if not isinstance(raw_version, str) or not raw_version.strip():
        raise InvalidCatalogQueryError("science_version debe ser una cadena no vacía.")
    target_version = raw_version.strip()

    resolved_manifest: Path | None
    if manifest_path is not None:
        resolved_manifest = Path(manifest_path)
    elif os.getenv("PLANETX_CATALOG_MANIFEST"):
        resolved_manifest = Path(os.environ["PLANETX_CATALOG_MANIFEST"])
    else:
        return None

    if not resolved_manifest.is_file():
        raise ManifestNotFoundError(f"No se encontró el manifiesto preparado: {resolved_manifest}")

    try:
        raw_data = json.loads(resolved_manifest.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ManifestCorruptError(f"Manifiesto JSON ilegible o malformado: {exc}") from exc

    if not isinstance(raw_data, dict) or not isinstance(raw_data.get("entries"), list):
        raise ManifestCorruptError("El manifiesto debe ser un objeto con lista 'entries'.")

    resolved_products_dir: Path
    if products_dir is not None:
        resolved_products_dir = Path(products_dir)
    elif os.getenv("PLANETX_PRODUCTS_DIR"):
        resolved_products_dir = Path(os.environ["PLANETX_PRODUCTS_DIR"])
    else:
        resolved_products_dir = resolved_manifest.parent / "products"

    seen_index_keys: set[tuple[float, float, float, str]] = set()
    matched_entry: dict[str, Any] | None = None

    for item in raw_data["entries"]:
        if not isinstance(item, dict) or not isinstance(item.get("query"), dict):
            raise ManifestCorruptError("Entrada de manifiesto sin bloque 'query' válido.")
        q = item["query"]
        try:
            entry_ra = _validate_finite_number(q.get("ra_deg"), "query.ra_deg")
            entry_dec = _validate_finite_number(q.get("dec_deg"), "query.dec_deg")
            entry_fov = _validate_finite_number(q.get("fov_deg"), "query.fov_deg")
        except InvalidCatalogQueryError as exc:
            raise ManifestCorruptError(str(exc)) from exc

        entry_sv = item.get("science_version")
        if not isinstance(entry_sv, str) or not entry_sv.strip():
            raise ManifestCorruptError("Entrada de manifiesto sin 'science_version' válida.")

        index_key = (entry_ra, entry_dec, entry_fov, entry_sv.strip())
        if index_key in seen_index_keys:
            raise ManifestCorruptError(
                f"Entrada duplicada en manifiesto para clave {index_key}."
            )
        seen_index_keys.add(index_key)

        if index_key == (ra, dec, fov, target_version):
            matched_entry = item

    if matched_entry is None:
        return None

    # Soporte de revocación lógica sin borrar historial del manifiesto
    if matched_entry.get("revoked") is True or matched_entry.get("active") is False:
        return None

    return _validate_and_normalize_entry(matched_entry, resolved_products_dir)