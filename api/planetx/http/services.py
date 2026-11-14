"""Fronteras inyectables de la API: catálogo preparado y ciencia (§5, handoffs).

Las firmas son la propuesta de Isaac para F01; las confirman sus dueños (DeValle
para ``get_prepared`` y Alexis para ``build_sequence``). Hasta que existan sus
módulos, la API usa los stubs de este archivo.
"""

from __future__ import annotations

import logging
import threading
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Protocol, TypeVar

import anyio
import anyio.from_thread
import anyio.to_thread

from planetx.http.errors import ArchiveUnavailable

logger = logging.getLogger("planetx.http")

T = TypeVar("T")

FOV_DEG = 0.1
"""Lado del campo en grados (§2: campo fijo de 0,10° × 0,10°)."""

SCIENCE_VERSION = "v1"
"""Versión de preparación/ciencia usada para buscar casos preparados."""


@dataclass(frozen=True)
class Cutout:
    """Recorte local con procedencia que el adaptador IRSA entrega a ciencia (§5)."""

    observation_id: str
    release: str  # "dr1" | "qr3"
    source_url: str
    local_path: str


@dataclass(frozen=True)
class SequenceResult:
    """Resultado científico (sin ``mode``) y mapa ``frame_id -> bytes PNG``."""

    payload: dict[str, Any]
    images: Mapping[str, bytes]


class PreparedCatalog(Protocol):
    def get_prepared(
        self, *, ra_deg: float, dec_deg: float, fov_deg: float, version: str
    ) -> dict[str, Any] | None:
        """Payload ``prepared`` compatible con el contrato v1, o ``None``."""


class ScienceService(Protocol):
    def build_sequence(
        self, *, ra_deg: float, dec_deg: float, fov_deg: float, cutouts: Sequence[Cutout]
    ) -> SequenceResult:
        """Resultado científico y PNG derivados para un centro y sus recortes."""


class UnconfiguredPreparedCatalog:
    """Stub: sin catálogo preparado todavía; nunca hay respaldo."""

    def get_prepared(
        self, *, ra_deg: float, dec_deg: float, fov_deg: float, version: str
    ) -> dict[str, Any] | None:
        return None


class UnconfiguredScience:
    """Stub: la búsqueda en vivo no está habilitada.

    Responde como fallo temporal reintentable (503), nunca como ``no_coverage``:
    no hubo consulta espacial, así que no se puede afirmar que no hay datos.
    """

    def build_sequence(
        self, *, ra_deg: float, dec_deg: float, fov_deg: float, cutouts: Sequence[Cutout]
    ) -> SequenceResult:
        raise ArchiveUnavailable("La búsqueda en vivo no está habilitada. Inténtalo más tarde.")


class LiveGate:
    """Limita cuántas ejecuciones en vivo corren a la vez.

    Si no hay cupo, falla de inmediato (sin encolar y sin lanzar otro hilo). El
    cupo se libera cuando el hilo termina de verdad, incluso si la petición ya
    respondió por tiempo agotado: un hilo abandonado sigue ocupando su cupo.
    """

    def __init__(self, concurrency: int) -> None:
        if concurrency < 1:
            raise ValueError("live_concurrency debe ser >= 1")
        self.concurrency = concurrency
        self._limiter = anyio.CapacityLimiter(concurrency)

    async def run(self, fn: Callable[..., T], /, **kwargs: Any) -> T:
        borrower = object()
        try:
            self._limiter.acquire_on_behalf_of_nowait(borrower)
        except anyio.WouldBlock:
            raise ArchiveUnavailable("Servicio ocupado. Inténtalo de nuevo en unos segundos.") from None

        released = False
        started = threading.Event()

        def release_once() -> None:  # siempre en el hilo del bucle de eventos
            nonlocal released
            if not released:
                released = True
                self._limiter.release_on_behalf_of(borrower)

        def worker() -> T:
            started.set()
            try:
                return fn(**kwargs)
            finally:
                try:
                    anyio.from_thread.run_sync(release_once)
                except Exception:  # bucle ya cerrado: nada que liberar
                    logger.warning("no se pudo liberar el cupo en vivo", exc_info=True)

        try:
            return await anyio.to_thread.run_sync(worker, abandon_on_cancel=True)
        except BaseException:
            if not started.is_set():  # cancelado antes de que el hilo arrancara
                release_once()
            raise
