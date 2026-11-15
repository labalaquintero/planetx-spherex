"""Reducción de MEF/FITS sin dependencias: conserva solo las extensiones pedidas.

El servicio de recortes de IRSA devuelve todas las extensiones y no permite pedir menos. En
las muestras la extensión EPSF ocupa ~3,9 MB de ~4,0 MB; el resto (imagen, FLAGS, VARIANCE,
ZODI, WCS-WAVE) pesa decenas de kB. Se copian los bloques de 2880 bytes tal cual: no se
reinterpretan ni modifican datos ni cabeceras.
"""

from __future__ import annotations

import math
import re

from planetx.irsa.errors import InvalidFits

BLOCK = 2880
CARD = 80
_MAX_HEADER_BLOCKS = 64
_MAX_HDUS = 32
_STRING_VALUE = re.compile(r"'((?:[^']|'')*)'")


class _Hdu:
    __slots__ = ("name", "start", "end")

    def __init__(self, name: str, start: int, end: int) -> None:
        self.name, self.start, self.end = name, start, end


def _card_value(card: str) -> str | None:
    if card[8:10] != "= ":
        return None
    return card[10:].strip()


def _parse_header(data: bytes, start: int) -> tuple[dict[str, str], int]:
    """Devuelve (cabecera, offset del primer byte tras los bloques de cabecera)."""
    header: dict[str, str] = {}
    pos = start
    for _ in range(_MAX_HEADER_BLOCKS):
        block = data[pos : pos + BLOCK]
        if len(block) < BLOCK:
            raise InvalidFits("FITS truncado en la cabecera")
        pos += BLOCK
        for i in range(0, BLOCK, CARD):
            card = block[i : i + CARD].decode("ascii", "replace")
            key = card[:8].strip()
            if key == "END":
                return header, pos
            value = _card_value(card)
            if value is not None and key not in header:
                header[key] = value
    raise InvalidFits("cabecera FITS sin END")


def _int(header: dict[str, str], key: str, default: int | None = None, *, signed: bool = False) -> int:
    raw = header.get(key)
    if raw is None:
        if default is None:
            raise InvalidFits(f"falta {key}")
        return default
    try:
        value = int(raw.split("/")[0].strip())
    except ValueError:
        raise InvalidFits(f"{key} inválido") from None
    if value < 0 and not signed:  # BITPIX es negativo en coma flotante (-32, -64)
        raise InvalidFits(f"{key} negativo")
    return value


def _string(header: dict[str, str], key: str) -> str:
    raw = header.get(key)
    match = _STRING_VALUE.match(raw) if raw else None
    return match.group(1).replace("''", "'").strip() if match else ""


def _walk(data: bytes) -> list[_Hdu]:
    if not data.startswith(b"SIMPLE  ="):
        raise InvalidFits("no es FITS (falta SIMPLE)")
    hdus: list[_Hdu] = []
    pos = 0
    while pos < len(data):
        if len(hdus) >= _MAX_HDUS:
            raise InvalidFits("demasiadas extensiones")
        header, data_start = _parse_header(data, pos)
        naxis = _int(header, "NAXIS")
        dims = [_int(header, f"NAXIS{i}") for i in range(1, naxis + 1)]
        bitpix = abs(_int(header, "BITPIX", signed=True))
        elements = math.prod(dims) if dims else 0
        size = bitpix // 8 * _int(header, "GCOUNT", 1) * (_int(header, "PCOUNT", 0) + elements)
        end = data_start + ((size + BLOCK - 1) // BLOCK) * BLOCK
        # El relleno final de la última extensión puede faltar en archivos truncados.
        if data_start + size > len(data):
            raise InvalidFits("FITS truncado en los datos")
        name = "PRIMARY" if not hdus else _string(header, "EXTNAME").upper()
        hdus.append(_Hdu(name, pos, min(end, len(data))))
        pos = end
    if not hdus:
        raise InvalidFits("FITS vacío")
    return hdus


def list_extensions(data: bytes) -> list[str]:
    return [h.name for h in _walk(data)]


def extract_extensions(data: bytes, keep: tuple[str, ...]) -> bytes:
    """PRIMARY + las extensiones de ``keep`` (en su orden original). Falla si falta IMAGE."""
    wanted = {name.upper() for name in keep}
    hdus = _walk(data)
    if "IMAGE" in wanted and not any(h.name == "IMAGE" for h in hdus):
        raise InvalidFits("falta la extensión IMAGE")
    out = b"".join(data[h.start : h.end] for h in hdus if h.name == "PRIMARY" or h.name in wanted)
    return out
