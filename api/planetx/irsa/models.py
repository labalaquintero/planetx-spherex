"""Tipos compartidos del adaptador IRSA (sin dependencias pesadas)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Cutout:
    """Handoff Isaac -> Alexis (§5): recorte local con procedencia.

    ``observation_id`` es ``<obs_id>/D<n>``: ``obs_id`` de SIA2 identifica la exposición y se
    repite por detector, así que no basta por sí solo (propuesta para Alexis, no contrato).
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
