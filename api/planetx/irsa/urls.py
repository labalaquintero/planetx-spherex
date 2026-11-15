"""Allowlist de URLs de IRSA. Las URLs salen de SIA2 y se validan; nunca vienen del cliente."""

from __future__ import annotations

import math
import re
from urllib.parse import urlsplit

from planetx.irsa.config import IrsaConfig
from planetx.irsa.errors import IrsaRejected

# Verificado con las muestras: DR1 y QR3, y 5 filas con ``l2b_retry-…`` en lugar de ``l2b-…``.
_ACCESS_URL = re.compile(
    r"/ibe/data/spherex/(?P<release>dr1|qr3)/level2/"
    r"(?P<week>[A-Za-z0-9_]+)/"
    r"(?P<proc>l2b(?:_retry)?-v\d+-\d{4}-\d+)/"
    r"(?P<det>[1-6])/"
    r"level2_[A-Za-z0-9_]+_spx_l2b(?:_retry)?-v\d+-\d{4}-\d+\.fits\Z",
    re.ASCII,
)

COLLECTION_RELEASE = {"spherex_dr1": "dr1", "spherex_qr3": "qr3"}


def ensure_allowed_host(url: str, config: IrsaConfig) -> None:
    """https, host exacto permitido, puerto por defecto, sin credenciales ni fragmento."""
    parts = urlsplit(url)
    try:
        port = parts.port
    except ValueError:
        raise IrsaRejected("URL no permitida") from None
    if (
        parts.scheme != "https"
        or parts.hostname not in config.allowed_hosts
        or parts.username is not None
        or parts.password is not None
        or port not in (None, 443)
        or parts.fragment
    ):
        raise IrsaRejected("URL no permitida")


def validate_access_url(url: object, collection: str, config: IrsaConfig) -> str:
    """Valida un ``access_url`` de SIA2 (FITS completo, sin query) y devuelve la URL."""
    if not isinstance(url, str) or not url or any(c in url for c in " \t\r\n\\"):
        raise IrsaRejected("access_url inválido")
    ensure_allowed_host(url, config)
    parts = urlsplit(url)
    match = _ACCESS_URL.fullmatch(parts.path)
    if parts.query or match is None or match["release"] != COLLECTION_RELEASE.get(collection):
        raise IrsaRejected("access_url fuera del patrón de IRSA")
    return url


def build_cutout_url(access_url: str, ra_deg: float, dec_deg: float, size_deg: float) -> str:
    """``<access_url>?center=<ra>,<dec>d&size=<s>``: el formato verificado en la sonda.

    La referencia de IBE documenta solo ``center``, ``size`` y ``gzip``.
    """
    if not all(math.isfinite(v) for v in (ra_deg, dec_deg, size_deg)) or size_deg <= 0:
        raise IrsaRejected("parámetros de recorte inválidos")
    return f"{access_url}?center={ra_deg:.8f},{dec_deg:.8f}d&size={size_deg:g}"
