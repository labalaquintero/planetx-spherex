"""Tipos compartidos del adaptador IRSA (sin dependencias pesadas)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Cutout:
    """Handoff Isaac -> Alexis (§5): recorte local con procedencia.

    ``observation_id`` es el OBSID de la exposición (``obs_id`` de SIA2, p. ej. ``2025W19_1B_0241_1``),
    sin sufijo de detector. Una exposición cubre el campo con varios detectores, pero una secuencia usa
    un solo detector, así que no se repite dentro de ella. El detector se conserva en la clave del
    recorte (``..._D<n>_<hash>.fits`` en ``local_path``) y en ``source_url``.
    ``source_url`` es el FITS completo de IRSA (``access_url``), no la URL del recorte.
    ``local_path`` es un FITS reducido (ver ``fits.extract_extensions``).
    """

    observation_id: str
    release: str  # "dr1" | "qr3"
    source_url: str
    local_path: str


@dataclass(frozen=True)
class SearchSummary:
    """Qué ocurrió en la búsqueda; permite distinguir ausencia real de fallo parcial."""

    collections_ok: tuple[str, ...]
    collections_failed: tuple[str, ...]
    rows_returned: int  # filas SIA2 totales (antes de filtrar)
    candidates_usable: int  # exposiciones con el campo completo dentro del detector
    cutouts_attempted: int
    cutouts_failed: int
    truncated: bool  # había más épocas útiles que fotogramas, o SIA2 desbordó MAXREC


@dataclass(frozen=True)
class CutoutSearch:
    cutouts: tuple[Cutout, ...]  # orden cronológico
    summary: SearchSummary
