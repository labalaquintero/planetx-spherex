"""Cobertura: ¿el centro queda dentro del footprint (``s_region``) con margen suficiente?

SIA2 con POS=CIRCLE devuelve footprints que solo *intersectan* el círculo; en las muestras el
3–8 % tenía el centro fuera, y los recortes truncados (p. ej. 59×12 px) eran exactamente esas
filas. Se trabaja en el plano tangente (gnomónico) centrado en la consulta, donde los círculos
máximos son rectas.
"""

from __future__ import annotations

import math
import re

_NUMBER = re.compile(r"[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?")


def parse_region(s_region: object) -> list[tuple[float, float]] | None:
    """``POLYGON ICRS ra dec ra dec …`` -> [(ra, dec), …] sin el vértice de cierre repetido."""
    if not isinstance(s_region, str):
        return None
    head, _, rest = s_region.strip().partition("ICRS")
    if head.strip().upper() != "POLYGON" or not rest:
        return None
    nums = [float(n) for n in _NUMBER.findall(rest)]
    if len(nums) < 6 or len(nums) % 2 or not all(math.isfinite(n) for n in nums):
        return None
    points = list(zip(nums[0::2], nums[1::2]))
    if len(points) > 1 and points[0] == points[-1]:
        points.pop()
    return points if len(points) >= 3 else None


def _tangent(ra0: float, dec0: float, ra: float, dec: float) -> tuple[float, float] | None:
    r0, d0, r, d = map(math.radians, (ra0, dec0, ra, dec))
    c = math.sin(d0) * math.sin(d) + math.cos(d0) * math.cos(d) * math.cos(r - r0)
    if c <= 1e-9:  # hemisferio opuesto: no se proyecta
        return None
    x = math.cos(d) * math.sin(r - r0) / c
    y = (math.cos(d0) * math.sin(d) - math.sin(d0) * math.cos(d) * math.cos(r - r0)) / c
    return math.degrees(x), math.degrees(y)


def edge_margin_deg(points: list[tuple[float, float]], ra0: float, dec0: float) -> float:
    """Distancia (°) del centro al borde: positiva dentro, negativa fuera, ``-inf`` si no hay."""
    plane = [_tangent(ra0, dec0, ra, dec) for ra, dec in points]
    if any(p is None for p in plane):
        return -math.inf
    poly: list[tuple[float, float]] = [p for p in plane if p is not None]

    inside = False
    best = math.inf
    for i, (x1, y1) in enumerate(poly):
        x2, y2 = poly[(i + 1) % len(poly)]
        if (y1 > 0.0) != (y2 > 0.0) and 0.0 < (x2 - x1) * (0.0 - y1) / (y2 - y1) + x1:
            inside = not inside
        dx, dy = x2 - x1, y2 - y1
        length2 = dx * dx + dy * dy
        if length2 == 0.0:
            continue
        t = max(0.0, min(1.0, -(x1 * dx + y1 * dy) / length2))
        best = min(best, math.hypot(x1 + t * dx, y1 + t * dy))
    return best if inside else -best
