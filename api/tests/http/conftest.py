"""Utilidades de prueba de la capa HTTP.

TODO lo que lleva el prefijo SYNTHETIC_ es SINTÉTICO: es el JSON de ejemplo de
§5 del contexto, sin observaciones reales de SPHEREx. Solo vive en pruebas.
"""

from __future__ import annotations

import copy
import struct
import zlib
from typing import Any

import pytest
from fastapi.testclient import TestClient

from irsa_helpers import access_url
from planetx.http import create_app
from planetx.http.services import SequenceResult

# --- SINTÉTICO (§5): no es una captura ni una respuesta real de la misión ---
SYNTHETIC_READY: dict[str, Any] = {
    "schema_version": "1",
    "status": "ready",
    "reason": None,
    "mode": "fixture",
    "query": {"ra_deg": 10.25, "dec_deg": -12.5, "frame": "ICRS", "fov_deg": 0.1},
    "band": {"center_um": 1.25, "tolerance_um": 0.02},
    "checked_at": "2026-11-14T12:00:00Z",
    "science_version": "v1",
    "warnings": [],
    "frames": [
        {
            "id": "fixture-a",
            "observed_at": "2026-01-05T00:00:00Z",
            "release": "fixture",
            "observation_id": "fixture-obs-a",
            "source_url": None,
            "image_url": "/api/v1/images/fixture-a",
            "quality_flags": [],
        },
        {
            "id": "fixture-b",
            "observed_at": "2026-07-05T00:00:00Z",
            "release": "fixture",
            "observation_id": "fixture-obs-b",
            "source_url": None,
            "image_url": "/api/v1/images/fixture-b",
            "quality_flags": [],
        },
    ],
}


def synthetic(**overrides: Any) -> dict[str, Any]:
    payload = copy.deepcopy(SYNTHETIC_READY)
    payload.update(overrides)
    return payload


def synthetic_prepared(**overrides: Any) -> dict[str, Any]:
    """Caso ``prepared`` SINTÉTICO con valores de forma realista (para manifiestos y payloads preparados).

    Un caso preparado público no admite ``release: "fixture"`` ni ``source_url: null`` (esos valores
    solo valen en modo ``fixture`` de dev/pruebas). Aquí: release ``dr1``, ``source_url`` con la
    forma de una URL de IRSA pero FICTICIA (semana ``SYNTHnnn``), fechas UTC con ``Z``, ids
    ``synthetic-*`` y ``observation_id`` = OBSID de la exposición (``^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$``,
    sin «/D2»; el detector va en ``source_url``). No es ninguna observación real de SPHEREx.
    """
    payload = copy.deepcopy(SYNTHETIC_READY)
    payload["mode"] = "prepared"
    payload["frames"] = [
        {
            "id": frame_id,  # SINTÉTICO
            "observed_at": observed_at,
            "release": "dr1",
            "observation_id": f"SYNTH{n:03d}_1A_0001_1",  # SINTÉTICO: OBSID de la exposición, sin detector
            "source_url": access_url("dr1", n, 2),  # FICTICIA, con forma válida de IRSA
            "image_url": f"/api/v1/images/{frame_id}",
            "quality_flags": [],
        }
        for n, (frame_id, observed_at) in enumerate(
            (("synthetic-a", "2026-01-05T08:24:22Z"), ("synthetic-b", "2026-07-05T17:41:09Z")), start=1
        )
    ]
    payload.update(overrides)
    return payload


def _chunk(kind: bytes, data: bytes) -> bytes:
    body = kind + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))


# PNG 1x1 válido generado aquí (sintético).
TINY_PNG = (
    b"\x89PNG\r\n\x1a\n"
    + _chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 0, 0, 0, 0))
    + _chunk(b"IDAT", zlib.compress(b"\x00\x7f"))
    + _chunk(b"IEND", b"")
)


class FakeCatalog:
    def __init__(self, result: dict[str, Any] | None = None, error: Exception | None = None):
        self.result, self.error, self.calls = result, error, []

    def get_prepared(self, *, ra_deg: float, dec_deg: float, fov_deg: float, science_version: str):
        self.calls.append(
            {"ra_deg": ra_deg, "dec_deg": dec_deg, "fov_deg": fov_deg, "science_version": science_version}
        )
        if self.error:
            raise self.error
        return copy.deepcopy(self.result)


class FakeScience:
    def __init__(
        self,
        payload: dict[str, Any] | None = None,
        images: dict[str, bytes] | None = None,
        error: Exception | None = None,
    ):
        self.payload, self.images, self.error, self.calls = payload, images or {}, error, []

    def build_sequence(self, *, ra_deg: float, dec_deg: float, fov_deg: float, cutouts):
        self.calls.append({"ra_deg": ra_deg, "dec_deg": dec_deg, "fov_deg": fov_deg, "cutouts": list(cutouts)})
        if self.error:
            raise self.error
        return SequenceResult(payload=copy.deepcopy(self.payload), images=self.images)


def make_client(**kwargs: Any) -> TestClient:
    # raise_server_exceptions=False: el 500 debe verse como respuesta HTTP real.
    return TestClient(create_app(**kwargs), raise_server_exceptions=False)


@pytest.fixture(autouse=True)
def _isolated_env(monkeypatch):
    # Las pruebas no deben depender de variables del entorno del desarrollador.
    for name in ("PLANETX_PRODUCTS_DIR", "PLANETX_CATALOG_MANIFEST", "PLANETX_LIVE_CONCURRENCY"):
        monkeypatch.delenv(name, raising=False)


@pytest.fixture
def client() -> TestClient:
    return make_client()
