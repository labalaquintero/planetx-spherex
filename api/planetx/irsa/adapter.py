"""Adaptador IRSA: SIA2 sobre spherex_dr1 y spherex_qr3 + recortes locales con procedencia.

Entrega a ciencia ``Cutout{observation_id, release, source_url, local_path}`` y un
``SearchSummary`` que permite distinguir ausencia real de datos de un fallo parcial.
Regla central: solo se llama «sin observaciones» si TODAS las colecciones respondieron bien.
"""

from __future__ import annotations

import hashlib
import logging
import math
import os
import time
from collections.abc import Callable
from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait
from pathlib import Path

import httpx

from planetx.irsa.client import IrsaHttp, is_transient
from planetx.irsa.config import IrsaConfig
from planetx.irsa.errors import IrsaError, IrsaRejected, IrsaTimeout, IrsaUnavailable
from planetx.irsa.fits import extract_extensions
from planetx.irsa.models import Cutout, CutoutSearch, SearchSummary
from planetx.irsa.selection import select_candidates
from planetx.irsa.sia2 import Candidate, SiaResult, query_collection
from planetx.irsa.urls import build_cutout_url

logger = logging.getLogger("planetx.irsa")

MIN_FRAMES = 2


class IrsaAdapter:
    def __init__(
        self,
        config: IrsaConfig | None = None,
        *,
        transport: httpx.BaseTransport | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self.config = config or IrsaConfig()
        self._http = IrsaHttp(self.config, transport=transport)
        self._sleep = sleep

    def close(self) -> None:
        self._http.close()

    # ------------------------------------------------------------------ API

    def find_cutouts(self, ra_deg: float, dec_deg: float, *, deadline: float | None = None) -> CutoutSearch:
        """Busca, elige y descarga. ``deadline`` es un instante ``time.monotonic()``."""
        cfg = self.config
        if not (math.isfinite(ra_deg) and math.isfinite(dec_deg)):
            raise IrsaRejected("coordenadas inválidas")
        deadline = deadline if deadline is not None else time.monotonic() + cfg.budget_s

        results, failures = self._search(ra_deg, dec_deg, deadline)
        rows = sum(r.rows for r in results)
        candidates = [c for r in results for c in r.candidates]
        selection = select_candidates(
            candidates,
            min_margin_deg=cfg.min_edge_margin_deg,
            min_epoch_separation_days=cfg.min_epoch_separation_days,
            max_attempts=cfg.max_attempts,
        )

        cutouts, attempted, failed, transient = self._download(selection.ordered, ra_deg, dec_deg, deadline)
        if len(cutouts) < MIN_FRAMES and (failures or transient):
            # Sin secuencia y con algún fallo (una colección caída, 503, plazo): error reintentable.
            # Es la única salida para «no se pudo comprobar»; nunca se degrada a «sin cobertura».
            raise _worst(failures + transient)

        truncated = (
            selection.epochs_available > cfg.max_frames
            or any(r.overflow for r in results)
            or bool(failures)
        )
        summary = SearchSummary(
            collections_ok=tuple(r.collection for r in results),
            collections_failed=tuple(n for n in cfg.collections if n not in {r.collection for r in results}),
            rows_returned=rows,
            candidates_usable=selection.usable,
            cutouts_attempted=attempted,
            cutouts_failed=failed,
            truncated=truncated,
        )
        logger.info(
            "irsa search rows=%d usable=%d epochs=%d cutouts=%d failed=%d truncated=%s",
            rows, selection.usable, selection.epochs_available, len(cutouts), failed, truncated,
        )
        return CutoutSearch(tuple(cutouts), summary)

    # ------------------------------------------------------------ internals

    def _search(self, ra: float, dec: float, deadline: float) -> tuple[list[SiaResult], list[IrsaError]]:
        cfg = self.config
        results: list[SiaResult] = []
        failures: list[IrsaError] = []
        with ThreadPoolExecutor(max_workers=len(cfg.collections), thread_name_prefix="irsa-sia") as pool:
            futures = {
                pool.submit(query_collection, self._http, name, ra, dec, cfg, deadline): name
                for name in cfg.collections
            }
            for future, name in futures.items():
                try:
                    results.append(future.result())
                except IrsaError as exc:
                    logger.warning("irsa sia collection=%s failed: %s", name, exc)
                    failures.append(exc)
        order = {name: i for i, name in enumerate(cfg.collections)}
        results.sort(key=lambda r: order[r.collection])
        return results, failures

    def _download(
        self, ordered: tuple[Candidate, ...], ra: float, dec: float, deadline: float
    ) -> tuple[list[Cutout], int, int, list[IrsaError]]:
        cfg = self.config
        queue = list(ordered)
        done: list[tuple[Candidate, Cutout]] = []
        transient: list[IrsaError] = []
        attempted = failed = 0
        pending: dict[Future[Cutout], Candidate] = {}

        with ThreadPoolExecutor(max_workers=cfg.cutout_workers, thread_name_prefix="irsa-cut") as pool:
            def submit_next() -> bool:
                nonlocal attempted
                if not queue or attempted >= cfg.max_attempts:
                    return False
                cand = queue.pop(0)
                attempted += 1
                pending[pool.submit(self._fetch_cutout, cand, ra, dec, deadline)] = cand
                return True

            for _ in range(cfg.max_frames):  # el pool limita el paralelismo; los fallos se sustituyen abajo
                submit_next()
            while pending:
                finished, _ = wait(pending, timeout=max(deadline - time.monotonic(), 0) + 0.5, return_when=FIRST_COMPLETED)
                if not finished:  # el plazo venció: los hilos terminan solos por su propio deadline
                    transient.append(IrsaTimeout("presupuesto agotado"))
                    for future in pending:
                        future.cancel()
                    break
                for future in finished:
                    cand = pending.pop(future)
                    try:
                        done.append((cand, future.result()))
                    except IrsaError as exc:
                        failed += 1
                        logger.warning("irsa cutout %s failed: %s", cand.release, exc)
                        if isinstance(exc, (IrsaTimeout, IrsaUnavailable)):
                            transient.append(exc)
                while len(done) + len(pending) < cfg.max_frames and submit_next():
                    pass

        done.sort(key=lambda item: item[0].t_min_mjd)
        return [c for _, c in done][: cfg.max_frames], attempted, failed, transient

    def _fetch_cutout(self, cand: Candidate, ra: float, dec: float, deadline: float) -> Cutout:
        cfg = self.config
        path = self._cache_path(cand, ra, dec)
        cutout = Cutout(cand.observation_id, cand.release, cand.access_url, str(path))
        if _cache_hit(path):
            return cutout

        url = build_cutout_url(cand.access_url, ra, dec, cfg.size_deg)
        kind = f"cutout:{cand.release}"
        for attempt in (1, 2):
            response = self._http.get(url, kind=kind, max_bytes=cfg.max_cutout_bytes, deadline=deadline)
            if response.status == 200:
                break
            if is_transient(response.status) and attempt == 1:
                delay = min(response.retry_after_s if response.retry_after_s is not None else 1.0, cfg.retry_after_cap_s)
                if time.monotonic() + delay >= deadline:
                    raise IrsaTimeout("sin tiempo para reintentar")
                self._sleep(delay)  # respeta Retry-After (medido: 5 s) si el presupuesto alcanza
                continue
            if is_transient(response.status):
                raise IrsaUnavailable(f"recorte respondió {response.status}")
            raise IrsaRejected(f"recorte respondió {response.status}")

        reduced = extract_extensions(response.body, cfg.keep_extensions)  # valida que es FITS
        _write_atomic(path, reduced)
        return cutout

    def _cache_path(self, cand: Candidate, ra: float, dec: float) -> Path:
        key = hashlib.sha256(f"{ra:.8f},{dec:.8f},{self.config.size_deg:g}".encode()).hexdigest()[:12]
        # obs_id ya se validó con ^[A-Za-z0-9_]+$: el nombre no puede salir del directorio.
        return self.config.cache_dir / cand.release / f"{cand.obs_id}_D{cand.detector}_{key}.fits"


def _cache_hit(path: Path) -> bool:
    try:
        with path.open("rb") as fh:
            return fh.read(9) == b"SIMPLE  =" and path.stat().st_size > 0
    except OSError:
        return False


def _write_atomic(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f"{path.name}.{os.getpid()}.{id(data)}.tmp")
    try:
        tmp.write_bytes(data)
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)


def _worst(errors: list[IrsaError]) -> IrsaError:
    """Elige el error a propagar: un timeout si lo hubo; si no, indisponibilidad."""
    for exc in errors:
        if isinstance(exc, IrsaTimeout):
            return IrsaTimeout(str(exc))
    return IrsaUnavailable(str(errors[0]) if errors else "IRSA no disponible")
