"""Rutas del contrato v1: health, comparaciones e imágenes."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from functools import partial
from typing import Annotated, Any

import anyio
import anyio.to_thread
from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse, Response

from planetx.http.coordinates import parse_coordinates
from planetx.http.errors import ImageNotFound, InternalError, QueryTimeout
from planetx.http.images import FRAME_ID_RE, ImageStore, InMemoryImageStore
from planetx.http.services import (
    FOV_DEG,
    SCIENCE_VERSION,
    LiveGate,
    PreparedCatalog,
    ScienceService,
)

logger = logging.getLogger("planetx.http")

IMAGE_URL_RE = re.compile(r"/api/v1/images/" + FRAME_ID_RE.pattern, re.ASCII)


@dataclass
class AppState:
    prepared: PreparedCatalog
    science: ScienceService
    gate: LiveGate
    live_timeout_s: float
    allow_fixtures: bool
    live_images: InMemoryImageStore
    image_store: ImageStore


router = APIRouter()


@router.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _finalize_payload(payload: Any, source: str, allow_fixtures: bool) -> dict[str, Any]:
    """Comprueba lo mínimo del payload sin redefinir el contrato de Alexis.

    Cualquier violación es un error propio (500): el detalle va a logs.
    """
    if not isinstance(payload, dict):
        _fail("el servicio no devolvió un objeto JSON")
    mode = payload.get("mode")
    if mode == "fixture":
        if not allow_fixtures:
            _fail("payload fixture fuera de dev/pruebas")
    elif source == "live":
        payload = {**payload, "mode": "live"}
    elif mode != "prepared":
        _fail(f"modo inesperado en caso preparado: {mode!r}")
    frames = payload.get("frames", [])
    if not isinstance(frames, list):
        _fail("frames no es una lista")
    for frame in frames:
        url = frame.get("image_url") if isinstance(frame, dict) else None
        if not isinstance(url, str) or not IMAGE_URL_RE.fullmatch(url):
            _fail("image_url no es una ruta del mismo origen /api/v1/images/<id>")
    return payload


def _fail(detail: str) -> None:
    logger.error("payload rechazado: %s", detail)
    raise InternalError()


@router.get("/api/v1/comparisons")
async def comparisons(
    request: Request,
    # Solo documentan OpenAPI: el valor se valida desde request.query_params para
    # rechazar NaN/Infinity, vacíos y parámetros repetidos (el parser de float no).
    ra_deg: Annotated[str | None, Query(description="RA ICRS en grados decimales, 0 <= ra < 360")] = None,
    dec_deg: Annotated[str | None, Query(description="Dec ICRS en grados decimales, -90 <= dec <= 90")] = None,
) -> JSONResponse:
    state: AppState = request.app.state.planetx
    ra, dec = parse_coordinates(request.query_params)

    try:
        with anyio.fail_after(state.live_timeout_s):
            prepared = await anyio.to_thread.run_sync(
                partial(
                    state.prepared.get_prepared,
                    ra_deg=ra,
                    dec_deg=dec,
                    fov_deg=FOV_DEG,
                    version=SCIENCE_VERSION,
                ),
                abandon_on_cancel=True,
            )
            if prepared is not None:
                payload = _finalize_payload(prepared, "prepared", state.allow_fixtures)
            else:
                result = await state.gate.run(
                    state.science.build_sequence,
                    ra_deg=ra,
                    dec_deg=dec,
                    fov_deg=FOV_DEG,
                    cutouts=(),  # el adaptador IRSA (subtarea g) los aportará
                )
                payload = _finalize_payload(result.payload, "live", state.allow_fixtures)
                state.live_images.put_many(result.images)
    except TimeoutError:
        raise QueryTimeout() from None

    return JSONResponse(payload)


@router.get("/api/v1/images/{frame_id:path}")
def get_image(frame_id: str, request: Request) -> Response:
    # ``:path`` captura cualquier texto para que un ID inválido (con «/», «..», URL,
    # byte nulo…) dé image_not_found, no un 404 genérico. El ID nunca se usa como ruta.
    state: AppState = request.app.state.planetx
    data = state.image_store.get_png(frame_id) if FRAME_ID_RE.match(frame_id) else None
    if data is None:
        raise ImageNotFound()
    return Response(
        content=data,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff"},
    )
