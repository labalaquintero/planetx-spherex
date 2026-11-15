"""Elección de candidatos a descargar a partir de los metadatos de SIA2 (sin descargar nada).

Criterios (§3): campo completo dentro del detector, un único grupo de banda gruesa (detector)
por secuencia, épocas bien separadas y sin repetir la misma exposición. La banda local exacta
sale de WCS-WAVE en cada recorte: es trabajo de ciencia (Alexis), no de este módulo.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

from planetx.irsa.sia2 import Candidate


@dataclass(frozen=True)
class Selection:
    ordered: tuple[Candidate, ...]  # prioridad de descarga: los primeros ``max_frames`` son los mejores
    usable: int  # exposiciones con el campo completo (todas las colecciones y detectores)
    detector: int | None
    epochs_available: int  # épocas separadas disponibles en el detector elegido


def _thin(items: list[Candidate], min_sep_days: float) -> list[Candidate]:
    """Una exposición por época: separación mínima entre instantes consecutivos."""
    out: list[Candidate] = []
    for item in sorted(items, key=lambda c: (c.t_min_mjd, c.obs_id)):
        if not out or item.t_min_mjd - out[-1].t_min_mjd >= min_sep_days:
            out.append(item)
    return out


def _spread_order(items: list[Candidate]) -> list[Candidate]:
    """Primero los extremos y luego el punto más alejado de los ya elegidos (muestreo espaciado)."""
    if len(items) <= 2:
        return list(items)
    chosen = [items[0], items[-1]]
    rest = items[1:-1]
    while rest:
        best = max(rest, key=lambda c: (min(abs(c.t_min_mjd - s.t_min_mjd) for s in chosen), -c.t_min_mjd))
        chosen.append(best)
        rest.remove(best)
    return chosen


def select_candidates(
    candidates: list[Candidate], *, min_margin_deg: float, min_epoch_separation_days: float, max_attempts: int
) -> Selection:
    usable = [c for c in candidates if c.margin_deg >= min_margin_deg]
    by_detector: dict[int, list[Candidate]] = defaultdict(list)
    for cand in usable:
        by_detector[cand.detector].append(cand)

    best_detector: int | None = None
    best_epochs: list[Candidate] = []
    best_key: tuple[int, float, int] | None = None
    for detector, group in by_detector.items():
        epochs = _thin(group, min_epoch_separation_days)
        span = epochs[-1].t_min_mjd - epochs[0].t_min_mjd if epochs else 0.0
        key = (min(len(epochs), 2), span, -detector)  # primero poder comparar (≥2), luego mayor separación
        if best_key is None or key > best_key:
            best_detector, best_epochs, best_key = detector, epochs, key

    ordered = _spread_order(best_epochs)[:max_attempts]
    return Selection(tuple(ordered), len(usable), best_detector, len(best_epochs))
