"""Compara recortes de IRSA y adapta el resultado al contrato HTTP v1."""

from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import cast

from planetx.http.errors import ArchiveUnavailable, QueryTimeout
from planetx.http.services import SCIENCE_VERSION, SequenceResult
from planetx.irsa import Cutout, IrsaAdapter, IrsaError, IrsaTimeout, SearchSummary
from planetx.science import Cutout as ScienceCutout
from planetx.science import build_sequence
from planetx.science.sequence import Release

logger = logging.getLogger("planetx.http")


class IrsaScienceService:
    def __init__(self, archive: IrsaAdapter) -> None:
        self._archive = archive

    def build_sequence(
        self, *, ra_deg: float, dec_deg: float, fov_deg: float, cutouts: Sequence[Cutout],
    ) -> SequenceResult:
        if cutouts:
            return self._compare(ra_deg, dec_deg, fov_deg, cutouts, None)

        with TemporaryDirectory(prefix="planetx-irsa-") as directory:
            try:
                search = self._archive.find_cutouts(ra_deg, dec_deg, cache_dir=Path(directory))
            except IrsaTimeout:
                raise QueryTimeout() from None
            except IrsaError:
                raise ArchiveUnavailable() from None
            return self._compare(ra_deg, dec_deg, fov_deg, search.cutouts, search.summary)

    @staticmethod
    def _compare(
        ra: float, dec: float, fov: float, cutouts: Sequence[Cutout], summary: SearchSummary | None,
    ) -> SequenceResult:
        partial_failure = summary is not None and bool(summary.collections_failed or summary.cutouts_failed)
        truncated = summary is not None and summary.truncated

        if (
            summary is not None
            and summary.collections_ok
            and not partial_failure
            and not truncated
            and summary.rows_returned == 0
        ):
            status, reason = "no_coverage", "no_observations"
            band, frames, images = None, [], {}
            science_version = SCIENCE_VERSION
        else:
            inputs = (
                ScienceCutout(cutout.observation_id, cast(Release, cutout.release), cutout.source_url, cutout.local_path)
                for cutout in cutouts
            )
            try:
                result, images = build_sequence(ra_deg=ra, dec_deg=dec, fov_deg=fov, cutouts=inputs)
            except (OSError, KeyError, ValueError) as exc:
                logger.warning("Recorte de IRSA inutilizable para ciencia: %s", type(exc).__name__)
                raise ArchiveUnavailable() from exc

            status, reason = result.status, result.reason
            if status == "insufficient":
                if partial_failure:
                    raise ArchiveUnavailable()
                if truncated:
                    reason = "search_limit_reached"
            band = result.band
            science_version = result.science_version
            frames = [
                {**frame, "image_url": f"/api/v1/images/{frame['id']}"}
                for frame in result.frames
            ]

        return SequenceResult(
            payload={
                "schema_version": "1",
                "status": status,
                "reason": reason,
                "query": {"ra_deg": ra, "dec_deg": dec, "frame": "ICRS", "fov_deg": fov},
                "band": band,
                "checked_at": datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
                "science_version": science_version,
                "warnings": ["search_limit_reached"] if truncated and status == "ready" else [],
                "frames": frames,
            },
            images=images,
        )
