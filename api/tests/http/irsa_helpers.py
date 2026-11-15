"""Auxiliares de prueba del adaptador IRSA. TODO es SINTÉTICO (marca ``SYNTH``): sin datos reales.

Los nombres de columnas y el patrón de URL reproducen lo observado en las muestras de IRSA, pero
las observaciones, fechas y semanas son inventadas y no corresponden a exposiciones reales.
"""

from __future__ import annotations

import math
import threading
import time
from collections.abc import Callable
from typing import Any
from xml.sax.saxutils import escape

import httpx

HOST = "irsa.ipac.caltech.edu"
RA0, DEC0 = 10.25, -12.5  # centro sintético (el mismo del ejemplo de §5)

_FIELDS = [
    ("obs_id", "char"), ("energy_bandpassname", "char"), ("access_url", "char"),
    ("access_format", "char"), ("calib_level", "short"), ("dataproduct_subtype", "char"),
    ("obs_collection", "char"), ("t_min", "double"), ("s_region", "char"),
]


def access_url(release: str, n: int, det: int) -> str:
    wk = f"SYNTH{n:03d}_1A"
    return (f"https://{HOST}/ibe/data/spherex/{release}/level2/{wk}/l2b-v27-2099-001/{det}/"
            f"level2_{wk}_0001_1D{det}_spx_l2b-v27-2099-001.fits")


def square_region(ra0: float, dec0: float, half_deg: float) -> str:
    """Footprint cuadrado SINTÉTICO de semilado ``half_deg`` alrededor de (ra0, dec0)."""
    dra = half_deg / math.cos(math.radians(dec0))
    pts = [(ra0 - dra, dec0 - half_deg), (ra0 + dra, dec0 - half_deg),
           (ra0 + dra, dec0 + half_deg), (ra0 - dra, dec0 + half_deg), (ra0 - dra, dec0 - half_deg)]
    return "POLYGON ICRS " + " ".join(f"{a:.9f} {b:.9f}" for a, b in pts)


def row(collection: str, n: int, det: int, t_min: float, *, half: float = 1.7, **over: Any) -> dict[str, Any]:
    release = "dr1" if collection == "spherex_dr1" else "qr3"
    base = {
        "obs_id": f"SYNTH{n:03d}_1A_0001_1", "energy_bandpassname": f"SPHEREx-D{det}",
        "access_url": access_url(release, n, det), "access_format": "image/fits", "calib_level": 2,
        "dataproduct_subtype": "science", "obs_collection": collection, "t_min": t_min,
        "s_region": square_region(RA0, DEC0, half),
    }
    base.update(over)
    return base


def votable(rows: list[dict[str, Any]], status: str = "OK") -> bytes:
    # ID="col_N" como en el VOTable real de IRSA: astropy nombra las columnas por ID, no por name.
    head = "".join(
        f'<FIELD name="{n}" datatype="{t}" ID="col_{i}"' + (' arraysize="*"' if t == "char" else "") + "/>"
        for i, (n, t) in enumerate(_FIELDS)
    )
    body = "".join("<TR>" + "".join(f"<TD>{escape(str(r[n]))}</TD>" for n, _ in _FIELDS) + "</TR>" for r in rows)
    return (
        '<?xml version="1.0" encoding="utf-8"?><VOTABLE version="1.3" xmlns="http://www.ivoa.net/xml/VOTable/v1.3">'
        f'<RESOURCE type="results"><INFO name="QUERY_STATUS" value="{status}"/><TABLE>{head}'
        f"<DATA><TABLEDATA>{body}</TABLEDATA></DATA></TABLE></RESOURCE></VOTABLE>"
    ).encode()


# ---------------------------------------------------------------- FITS sintético
def _card(key: str, value: object) -> str:
    text = f"'{value:<8}'" if isinstance(value, str) else ("T" if value is True else str(value))
    return f"{key:<8}= {text:>20}".ljust(80)[:80]


def _header(cards: list[str]) -> bytes:
    raw = "".join(c.ljust(80) for c in cards) + "END".ljust(80)
    return raw.ljust(-(-len(raw) // 2880) * 2880).encode("ascii")


def _pad(n: int) -> bytes:
    return b"\0" * (-(-n // 2880) * 2880)


def make_fits(*, shape: tuple[int, int] = (59, 59), epsf_bytes: int = 200_000) -> bytes:
    """MEF sintético con las mismas extensiones que un recorte de SPHEREx (datos en cero)."""
    out = _header([_card("SIMPLE", True), _card("BITPIX", 8), _card("NAXIS", 0), _card("EXTEND", True)])
    n1, n2 = shape
    for name in ("IMAGE", "FLAGS", "VARIANCE", "ZODI"):
        out += _header([_card("XTENSION", "IMAGE"), _card("BITPIX", -32), _card("NAXIS", 2), _card("NAXIS1", n1),  # float32 como el real
                        _card("NAXIS2", n2), _card("PCOUNT", 0), _card("GCOUNT", 1), _card("EXTNAME", name)])
        out += _pad(4 * n1 * n2)
    for name, rows in (("EPSF", epsf_bytes // 100), ("WCS-WAVE", 11)):
        out += _header([_card("XTENSION", "BINTABLE"), _card("BITPIX", 8), _card("NAXIS", 2), _card("NAXIS1", 100),
                        _card("NAXIS2", rows), _card("PCOUNT", 0), _card("GCOUNT", 1), _card("EXTNAME", name)])
        out += _pad(100 * rows)
    return out


# ---------------------------------------------------------------- IRSA simulado
class FakeIrsa:
    """Transporte simulado. ``cutout`` decide la respuesta por petición (índice, url)."""

    def __init__(
        self,
        sia: dict[str, bytes | int | Callable[[], httpx.Response]],
        cutout: Callable[[httpx.Request, int], httpx.Response] | None = None,
    ) -> None:
        self.sia, self.cutout = sia, cutout or (lambda req, n: httpx.Response(200, content=make_fits()))
        self.requests: list[httpx.Request] = []
        self.cutout_calls = 0
        self.inflight = self.max_inflight = 0
        self._lock = threading.Lock()

    def __call__(self, request: httpx.Request) -> httpx.Response:
        with self._lock:
            self.requests.append(request)
            self.inflight += 1
            self.max_inflight = max(self.max_inflight, self.inflight)
        try:
            if request.url.path == "/SIA":
                entry = self.sia[request.url.params["COLLECTION"]]
                if callable(entry):
                    return entry()
                return httpx.Response(entry) if isinstance(entry, int) else httpx.Response(200, content=entry)
            with self._lock:
                self.cutout_calls += 1
                n = self.cutout_calls
            time.sleep(0.01)
            return self.cutout(request, n)
        finally:
            with self._lock:
                self.inflight -= 1

    @property
    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self)

    def cutout_requests(self) -> list[httpx.Request]:
        return [r for r in self.requests if r.url.path != "/SIA"]
