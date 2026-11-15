"""Transporte HTTP hacia IRSA con plazos duros, tope de bytes y concurrencia acotada.

Se usa httpx en lugar de pyvo: pyvo hace ``session.get(..., stream=True, allow_redirects=True)``
sin timeout y siguiendo redirecciones (pyvo/dal/query.py, ``submit``), lo que impide imponer
plazo total, allowlist de hosts y tope de tamaño.
"""

from __future__ import annotations

import logging
import threading
import time
from collections.abc import Mapping
from dataclasses import dataclass

import httpx

from planetx.irsa.config import IrsaConfig
from planetx.irsa.errors import IrsaRejected, IrsaTimeout, IrsaUnavailable
from planetx.irsa.urls import ensure_allowed_host

# httpx registra cada petición con su URL completa en INFO; aquí solo se registran clases.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logger = logging.getLogger("planetx.irsa")

_TRANSIENT = {429, 500, 502, 503, 504}


@dataclass(frozen=True)
class Response:
    status: int
    body: bytes
    retry_after_s: float | None


class IrsaHttp:
    def __init__(self, config: IrsaConfig, *, transport: httpx.BaseTransport | None = None) -> None:
        self._config = config
        self._slots = threading.BoundedSemaphore(config.outbound_concurrency)
        self._client = httpx.Client(
            transport=transport,
            follow_redirects=False,  # un 3xx es error: no se sale del host permitido
            headers={"User-Agent": config.user_agent},
            trust_env=False,  # sin proxies ni credenciales del entorno
        )

    def close(self) -> None:
        self._client.close()

    def get(
        self,
        url: str,
        *,
        kind: str,
        max_bytes: int,
        deadline: float,
        params: Mapping[str, str] | None = None,
    ) -> Response:
        """GET con plazo duro. ``kind`` es una etiqueta de log (nunca la URL)."""
        ensure_allowed_host(url, self._config)
        started = time.monotonic()
        remaining = deadline - started
        if remaining <= 0:
            raise IrsaTimeout("presupuesto agotado")
        if not self._slots.acquire(timeout=min(remaining, self._config.pool_timeout_s * 2)):
            raise IrsaTimeout("sin cupo de conexiones salientes")
        try:
            return self._get(url, kind, max_bytes, deadline, params, started)
        finally:
            self._slots.release()

    def _get(
        self,
        url: str,
        kind: str,
        max_bytes: int,
        deadline: float,
        params: Mapping[str, str] | None,
        started: float,
    ) -> Response:
        cfg = self._config
        remaining = max(deadline - time.monotonic(), 0.001)
        timeout = httpx.Timeout(
            connect=min(cfg.connect_timeout_s, remaining),
            read=min(cfg.read_timeout_s, remaining),
            write=min(cfg.read_timeout_s, remaining),
            pool=min(cfg.pool_timeout_s, remaining),
        )
        status = 0
        received = 0
        try:
            with self._client.stream("GET", url, params=params, timeout=timeout) as response:
                status = response.status_code
                if 300 <= status < 400:
                    raise IrsaUnavailable("redirección no permitida")
                declared = response.headers.get("content-length")
                if declared and declared.isdigit() and int(declared) > max_bytes:
                    raise IrsaRejected("respuesta demasiado grande")
                chunks: list[bytes] = []
                for chunk in response.iter_bytes():
                    received += len(chunk)
                    if received > max_bytes:
                        raise IrsaRejected("respuesta demasiado grande")
                    if time.monotonic() > deadline:  # plazo total duro, también con goteo lento
                        raise IrsaTimeout("presupuesto agotado")
                    chunks.append(chunk)
                retry_after = _parse_retry_after(response.headers.get("retry-after"))
        except httpx.TimeoutException:
            raise IrsaTimeout("tiempo de espera agotado") from None
        except httpx.HTTPError:
            raise IrsaUnavailable("fallo de red hacia IRSA") from None
        finally:
            logger.info(
                "irsa kind=%s status=%s bytes=%d ms=%d",
                kind,
                status or "-",
                received,
                (time.monotonic() - started) * 1000,
            )
        return Response(status=status, body=b"".join(chunks), retry_after_s=retry_after)


def _parse_retry_after(value: str | None) -> float | None:
    if value and value.strip().isdigit():
        return float(value.strip())
    return None


def is_transient(status: int) -> bool:
    return status in _TRANSIENT
