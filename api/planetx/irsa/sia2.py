"""Consulta SIA2 de IRSA y parseo del VOTable.

Parámetros tal como los serializa pyvo (``SIA2Service.search``): GET a ``/SIA`` con
``COLLECTION`` y ``POS=CIRCLE <ra> <dec> <radio>`` (grados), más ``MAXREC``.
"""

from __future__ import annotations

import io
import logging
import math
import re
import time
import warnings
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from planetx.irsa.client import IrsaHttp, is_transient
from planetx.irsa.config import IrsaConfig
from planetx.irsa.errors import IrsaRejected, IrsaUnavailable
from planetx.irsa.geometry import edge_margin_deg, parse_region
from planetx.irsa.urls import COLLECTION_RELEASE, validate_access_url

logger = logging.getLogger("planetx.irsa")

_MJD_EPOCH = datetime(1858, 11, 17, tzinfo=UTC)
_DETECTOR = re.compile(r"SPHEREx-D([1-6])\Z", re.ASCII)
_OBS_ID = re.compile(r"[A-Za-z0-9_]{1,64}\Z", re.ASCII)
_QUERY_STATUS = re.compile(rb'<INFO[^>]*\bname="QUERY_STATUS"[^>]*\bvalue="([A-Za-z]+)"')
_REQUIRED = (
    "obs_id",
    "energy_bandpassname",
    "access_url",
    "access_format",
    "calib_level",
    "dataproduct_subtype",
    "obs_collection",
    "t_min",
    "s_region",
)


@dataclass(frozen=True)
class Candidate:
    release: str  # "dr1" | "qr3"
    obs_id: str
    detector: int
    access_url: str
    t_min_mjd: float
    margin_deg: float  # distancia del centro al borde del footprint

    @property
    def observation_id(self) -> str:
        return f"{self.obs_id}/D{self.detector}"

    @property
    def observed_at(self) -> datetime:
        return _MJD_EPOCH + timedelta(days=self.t_min_mjd)


@dataclass(frozen=True)
class SiaResult:
    collection: str
    rows: int
    candidates: tuple[Candidate, ...]
    overflow: bool


def build_params(collection: str, ra_deg: float, dec_deg: float, config: IrsaConfig) -> dict[str, str]:
    if collection not in COLLECTION_RELEASE:
        raise IrsaRejected("colección no permitida")
    if not (math.isfinite(ra_deg) and math.isfinite(dec_deg)):
        raise IrsaRejected("coordenadas inválidas")
    return {
        "COLLECTION": collection,
        "POS": f"CIRCLE {ra_deg:.8f} {dec_deg:.8f} {config.search_radius_deg:g}",
        "MAXREC": str(config.sia_maxrec),
    }


def query_collection(
    http: IrsaHttp, collection: str, ra_deg: float, dec_deg: float, config: IrsaConfig, deadline: float
) -> SiaResult:
    params = build_params(collection, ra_deg, dec_deg, config)
    response = http.get(
        config.sia_url, kind=f"sia:{COLLECTION_RELEASE[collection]}",
        max_bytes=config.max_sia_bytes, deadline=deadline, params=params,
    )
    if response.status != 200:
        raise IrsaUnavailable(f"SIA2 respondió {response.status}" + (" (reintentable)" if is_transient(response.status) else ""))
    started = time.monotonic()
    result = parse_votable(response.body, collection, ra_deg, dec_deg, config)
    logger.info(
        "irsa sia %s rows=%d usable=%d parse_ms=%d",
        COLLECTION_RELEASE[collection], result.rows, len(result.candidates), (time.monotonic() - started) * 1000,
    )
    return result


def parse_votable(body: bytes, collection: str, ra_deg: float, dec_deg: float, config: IrsaConfig) -> SiaResult:
    match = _QUERY_STATUS.search(body[:65536])
    status = match.group(1).decode() if match else "OK"
    if status.upper() not in ("OK", "OVERFLOW"):
        raise IrsaUnavailable("SIA2 informó un error de consulta")

    from astropy.io.votable import parse  # importación diferida: ~0,2 s y numpy

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            table = parse(io.BytesIO(body), verify="ignore").get_first_table().array
    except Exception:  # VOTable mal formado: cualquier fallo del parser es «respuesta inútil»
        raise IrsaUnavailable("respuesta SIA2 ilegible") from None

    # astropy nombra las columnas por el atributo ID (col_0, col_1…) y deja el nombre real como
    # *title*; ``dtype.fields`` admite ambos y ``row[nombre]`` funciona (verificado con IRSA real).
    names = set(table.dtype.fields or ())
    if any(col not in names for col in _REQUIRED):
        raise IrsaUnavailable("respuesta SIA2 sin las columnas esperadas")

    release = COLLECTION_RELEASE[collection]
    seen: set[tuple[str, int]] = set()
    candidates: list[Candidate] = []
    for row in table:
        candidate = _row_to_candidate(row, collection, release, ra_deg, dec_deg, config)
        if candidate is None:
            continue
        key = (candidate.obs_id, candidate.detector)
        if key in seen:  # deduplicar por observación (exposición + detector), no por fecha
            continue
        seen.add(key)
        candidates.append(candidate)
    return SiaResult(collection, len(table), tuple(candidates), overflow=status.upper() == "OVERFLOW")


def _text(value: object) -> str:
    return value.decode("utf-8", "replace") if isinstance(value, bytes) else str(value)


def _row_to_candidate(
    row: object, collection: str, release: str, ra_deg: float, dec_deg: float, config: IrsaConfig
) -> Candidate | None:
    try:
        if (
            _text(row["access_format"]) != "image/fits"  # type: ignore[index]
            or int(row["calib_level"]) != 2  # type: ignore[index]
            or _text(row["dataproduct_subtype"]) != "science"  # type: ignore[index]
            or _text(row["obs_collection"]) != collection  # type: ignore[index]
        ):
            return None
        obs_id = _text(row["obs_id"])  # type: ignore[index]
        det = _DETECTOR.match(_text(row["energy_bandpassname"]))  # type: ignore[index]
        t_min = float(row["t_min"])  # type: ignore[index]
        if det is None or not _OBS_ID.match(obs_id) or not math.isfinite(t_min):
            return None
        url = validate_access_url(_text(row["access_url"]), collection, config)  # type: ignore[index]
        region = parse_region(_text(row["s_region"]))  # type: ignore[index]
    except Exception:  # una fila inválida (o enmascarada) se descarta; no tumba la búsqueda
        return None
    if region is None:
        return None
    margin = edge_margin_deg(region, ra_deg, dec_deg)
    return Candidate(release, obs_id, int(det.group(1)), url, t_min, margin)
