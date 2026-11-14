"""Errores públicos del contrato v1: {"error": {"code": ..., "message": ...}}."""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("planetx.http")

RETRY_AFTER_SECONDS = "5"


class ApiError(Exception):
    """Error con código público estable y mensaje breve, sin detalles internos."""

    status_code = 500
    code = "internal_error"
    default_message = "Error interno. Inténtalo de nuevo más tarde."

    def __init__(self, message: str | None = None, *, headers: dict[str, str] | None = None):
        self.message = message or self.default_message
        self.headers = headers or {}
        super().__init__(self.message)


class InvalidCoordinates(ApiError):
    status_code = 422
    code = "invalid_coordinates"
    default_message = "Coordenadas ICRS inválidas."


class ImageNotFound(ApiError):
    status_code = 404
    code = "image_not_found"
    default_message = "Imagen no encontrada."


class ArchiveUnavailable(ApiError):
    """Fallo externo o capacidad agotada. Reintentable; nunca equivale a no_coverage."""

    status_code = 503
    code = "archive_unavailable"
    default_message = "El archivo de datos no está disponible. Inténtalo de nuevo en unos segundos."

    def __init__(self, message: str | None = None, *, headers: dict[str, str] | None = None):
        super().__init__(message, headers={"Retry-After": RETRY_AFTER_SECONDS, **(headers or {})})


class QueryTimeout(ApiError):
    """La consulta no terminó a tiempo. Reintentable; nunca equivale a no_coverage."""

    status_code = 503
    code = "query_timeout"
    default_message = "La consulta tardó demasiado. Inténtalo de nuevo en unos segundos."

    def __init__(self, message: str | None = None, *, headers: dict[str, str] | None = None):
        super().__init__(message, headers={"Retry-After": RETRY_AFTER_SECONDS, **(headers or {})})


class InternalError(ApiError):
    status_code = 500
    code = "internal_error"


def error_response(
    status_code: int, code: str, message: str, headers: dict[str, str] | None = None
) -> JSONResponse:
    return JSONResponse(
        {"error": {"code": code, "message": message}},
        status_code=status_code,
        headers=headers,
    )


async def _handle_api_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, ApiError)
    return error_response(exc.status_code, exc.code, exc.message, exc.headers)


async def _handle_http_exception(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    # Rutas inexistentes o método no permitido: extensión fuera del contrato v1 (ver informe).
    codes = {404: ("not_found", "Recurso no encontrado."), 405: ("method_not_allowed", "Método no permitido.")}
    code, message = codes.get(exc.status_code, ("http_error", "Solicitud no válida."))
    headers = dict(exc.headers) if exc.headers else None
    return error_response(exc.status_code, code, message, headers)


async def _handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
    # El diagnóstico va solo a los logs internos; la respuesta pública es fija.
    logger.error("unhandled error on %s %s", request.method, request.url.path, exc_info=exc)
    return error_response(500, InternalError.code, InternalError.default_message)


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiError, _handle_api_error)
    app.add_exception_handler(StarletteHTTPException, _handle_http_exception)
    app.add_exception_handler(Exception, _handle_unexpected)
