"""Regresiones de la conexión IRSA → ciencia → HTTP, con datos sintéticos."""

from pathlib import Path

import pytest

import planetx.irsa as irsa
from conftest import FakeCatalog, TINY_PNG, make_client, synthetic_prepared
from planetx.http import live
from planetx.science import ScienceResult


class ArchiveStub:
    def __init__(self, result: irsa.CutoutSearch | irsa.IrsaError) -> None:
        self.result = result
        self.calls: list[tuple[float, float, Path]] = []
        self.closed = False

    def find_cutouts(self, ra: float, dec: float, *, cache_dir: Path) -> irsa.CutoutSearch:
        assert cache_dir.is_dir()
        self.calls.append((ra, dec, cache_dir))
        if isinstance(self.result, irsa.IrsaError):
            raise self.result
        return self.result

    def close(self) -> None:
        self.closed = True


def _install_archive(monkeypatch: pytest.MonkeyPatch, archive: ArchiveStub) -> None:
    def create(config: irsa.IrsaConfig) -> ArchiveStub:
        assert config.size_deg == 0.15
        return archive

    monkeypatch.setattr(irsa, "IrsaAdapter", create)
    monkeypatch.setenv("PLANETX_ENABLE_LIVE", "1")


def _summary(
    *, rows: int = 0, usable: int = 0, failures: tuple[str, ...] = (), failed_cutouts: int = 0,
    truncated: bool = False,
) -> irsa.SearchSummary:
    collections = ("spherex_dr1", "spherex_qr3")
    return irsa.SearchSummary(
        collections_ok=tuple(collection for collection in collections if collection not in failures),
        collections_failed=failures,
        rows_returned=rows,
        candidates_usable=usable,
        cutouts_attempted=usable,
        cutouts_failed=failed_cutouts,
        truncated=truncated,
    )


QUERY = "/api/v1/comparisons?ra_deg=10.25&dec_deg=-12.5"


def test_live_builds_contract_and_serves_science_pngs(monkeypatch, tmp_path):
    sample = synthetic_prepared()
    frames = sample["frames"]
    cutouts = tuple(
        irsa.Cutout(frame["observation_id"], frame["release"], frame["source_url"], str(tmp_path / "cutout.fits"))
        for frame in frames
    )
    archive = ArchiveStub(irsa.CutoutSearch(cutouts, _summary(rows=2, usable=2, truncated=True)))
    _install_archive(monkeypatch, archive)

    def build(*, ra_deg, dec_deg, fov_deg, cutouts):
        assert (ra_deg, dec_deg, fov_deg) == (10.25, -12.5, 0.1)
        assert [cutout.observation_id for cutout in cutouts] == [frame["observation_id"] for frame in frames]
        output = [{key: value for key, value in frame.items() if key != "image_url"} for frame in frames]
        return (
            ScienceResult("ready", None, sample["band"], output, 1.0, (0.0, 1.0)),
            {frame["id"]: TINY_PNG for frame in frames},
        )

    monkeypatch.setattr(live, "build_sequence", build)
    with make_client() as client:
        response = client.get(QUERY)
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["mode"] == "live"
        assert payload["status"] == "ready"
        assert payload["schema_version"] == "1"
        assert payload["query"] == sample["query"]
        assert payload["frames"] == frames
        assert payload["warnings"] == ["search_limit_reached"]
        assert payload["checked_at"].endswith("Z")
        for frame in payload["frames"]:
            png = client.get(frame["image_url"])
            assert png.status_code == 200
            assert png.content == TINY_PNG
        assert len(archive.calls) == 1
        assert not archive.calls[0][2].exists()
    assert archive.closed


@pytest.mark.parametrize(
    ("summary", "expected_status", "expected_reason"),
    [
        (_summary(), "no_coverage", "no_observations"),
        (_summary(rows=3), "insufficient", "no_usable_frames"),
        (_summary(truncated=True), "insufficient", "search_limit_reached"),
    ],
)
def test_live_distinguishes_no_coverage_from_unusable_data(
    monkeypatch, summary, expected_status, expected_reason,
):
    archive = ArchiveStub(irsa.CutoutSearch((), summary))
    _install_archive(monkeypatch, archive)
    with make_client() as client:
        response = client.get(QUERY)
    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "live"
    assert payload["status"] == expected_status
    assert payload["reason"] == expected_reason
    assert payload["frames"] == []
    assert payload["band"] is None


@pytest.mark.parametrize(
    ("result", "public_code"),
    [
        (irsa.IrsaTimeout("timeout de prueba"), "query_timeout"),
        (irsa.IrsaUnavailable("caída de prueba"), "archive_unavailable"),
        (irsa.CutoutSearch((), _summary(failures=("spherex_qr3",))), "archive_unavailable"),
        (irsa.CutoutSearch((), _summary(rows=2, usable=2, failed_cutouts=2)), "archive_unavailable"),
    ],
)
def test_live_returns_retryable_error_when_archive_is_incomplete(monkeypatch, result, public_code):
    archive = ArchiveStub(result)
    _install_archive(monkeypatch, archive)
    with make_client() as client:
        response = client.get(QUERY)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == public_code
    assert response.headers["Retry-After"] == "5"
    assert not archive.calls[0][2].exists()


def test_prepared_catalog_keeps_priority_with_live_enabled(monkeypatch):
    archive = ArchiveStub(irsa.IrsaUnavailable("no debe consultarse"))
    _install_archive(monkeypatch, archive)
    with make_client(prepared=FakeCatalog(synthetic_prepared())) as client:
        response = client.get(QUERY)
    assert response.status_code == 200
    assert response.json()["mode"] == "prepared"
    assert archive.calls == []
