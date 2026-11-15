"""Validación de coordenadas ICRS en grados decimales (contrato v1, §5)."""

from __future__ import annotations

import math
import re
from typing import Protocol

from planetx.http.errors import InvalidCoordinates

# Solo decimales con signo opcional y punto decimal: sin exponente, comas, guiones
# bajos, espacios, hex, nan ni inf (float() de Python aceptaría varios de ellos).
_DECIMAL = re.compile(r"[+-]?(?:\d+\.?\d*|\.\d+)\Z", re.ASCII)


class _MultiParams(Protocol):
    def getlist(self, key: str) -> list[str]: ...


def _parse_one(name: str, values: list[str], low: float, high: float, *, high_inclusive: bool) -> float:
    if len(values) != 1:
        raise InvalidCoordinates(f"{name} es obligatorio y debe indicarse una sola vez.")
    raw = values[0]
    if not _DECIMAL.match(raw):
        raise InvalidCoordinates(f"{name} debe ser un número decimal finito en grados, con punto decimal.")
    value = float(raw)
    in_range = low <= value <= high if high_inclusive else low <= value < high
    if not math.isfinite(value) or not in_range:
        bound = "≤" if high_inclusive else "<"
        raise InvalidCoordinates(f"{name} fuera de rango: se requiere {low:g} ≤ {name} {bound} {high:g}.")
    return value


def parse_coordinates(params: _MultiParams) -> tuple[float, float]:
    """Devuelve (ra_deg, dec_deg) o lanza InvalidCoordinates (422)."""
    ra = _parse_one("ra_deg", params.getlist("ra_deg"), 0.0, 360.0, high_inclusive=False)
    dec = _parse_one("dec_deg", params.getlist("dec_deg"), -90.0, 90.0, high_inclusive=True)
    return ra, dec
