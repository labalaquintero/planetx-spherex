"""Adaptador IRSA de punta a punta con transporte simulado. Sin red; datos SINTÉTICOS."""

import logging
import re
import time

import httpx
import pytest

from irsa_helpers import DEC0, RA0, FakeIrsa, make_fits, row, votable
from planetx.irsa import IrsaAdapter, IrsaConfig
from planetx.irsa.errors import IrsaTimeout, IrsaUnavailable

DR1, QR3 = "spherex_dr1", "spherex_qr3"
OBSERVATION_ID_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}\Z", re.ASCII)  # misma que planetx.catalog


def scenario():
    """8 épocas separadas en D3 (4 en cada colección), un D5 suelto y una fila con cobertura parcial."""
    dr1 = [row(DR1, n, 3, 60000.0 + 40 * n) for n in range(1, 5)]
    qr3 = [row(QR3, n, 3, 60000.0 + 40 * n) for n in range(5, 9)]
    dr1 += [row(DR1, 20, 5, 60010.0), row(DR1, 21, 3, 60500.0, half=0.03)]  # esta última: margen < 0,0708
    return {DR1: votable(dr1), QR3: votable(qr3)}


def adapter(tmp_path, fake, sleep=None, **cfg):
    config = IrsaConfig(cache_dir=tmp_path / "raw", **cfg)
    return IrsaAdapter(config, transport=fake.transport, sleep=sleep or (lambda s: None))


def find(ad):
    return ad.find_cutouts(RA0, DEC0)


def test_happy_path_handoff_shape_provenance_and_limits(tmp_path):
    fake = FakeIrsa(scenario())
    result = find(adapter(tmp_path, fake))

    assert 2 <= len(result.cutouts) <= 6
    # Un solo grupo de banda gruesa (detector 3), que se ve en el recorte y no en el observation_id.
    assert all("_D3_" in c.local_path and "/3/" in c.source_url for c in result.cutouts)
    ids = [c.observation_id for c in result.cutouts]
    assert all(OBSERVATION_ID_RE.match(i) and "/" not in i for i in ids)  # regla del catálogo, sin «/D3»
    assert len(set(ids)) == len(ids)  # únicos dentro de la secuencia
    assert result.summary.truncated  # 8 épocas útiles > 6 fotogramas
    assert result.summary.collections_ok == (DR1, QR3) and result.summary.collections_failed == ()
    assert result.summary.rows_returned == 10 and result.summary.candidates_usable == 9  # la parcial se excluye

    for c in result.cutouts:
        assert c.release in ("dr1", "qr3")
        assert c.source_url.startswith("https://irsa.ipac.caltech.edu/ibe/data/spherex/")
        assert "?" not in c.source_url  # FITS completo, no la URL del recorte
        local = tmp_path / "raw" / c.release
        assert c.local_path.startswith(str(local)) and c.local_path.endswith(".fits")
        data = open(c.local_path, "rb").read()
        assert data.startswith(b"SIMPLE  =") and b"EPSF" not in data and len(data) < 100_000

    urls = [str(r.url) for r in fake.cutout_requests()]
    assert all("center=10.25000000,-12.50000000d&size=0.1" in u for u in urls)
    assert not any("SYNTH021" in u for u in urls)  # la fila de cobertura parcial no se descarga
    assert {r.url.host for r in fake.requests} == {"irsa.ipac.caltech.edu"}
    chrono = [c.observation_id for c in result.cutouts]
    assert chrono == sorted(chrono, key=lambda o: int(o[5:8]))


def test_second_search_reuses_cache(tmp_path):
    fake = FakeIrsa(scenario())
    ad = adapter(tmp_path, fake)
    first = find(ad)
    calls = fake.cutout_calls
    second = find(ad)
    assert fake.cutout_calls == calls and [c.local_path for c in second.cutouts] == [c.local_path for c in first.cutouts]


def test_503_is_retried_once_honoring_retry_after_capped(tmp_path):
    seen = {}

    def cutout(req, n):
        seen[str(req.url)] = seen.get(str(req.url), 0) + 1
        if seen[str(req.url)] == 1:
            return httpx.Response(503, content=b"x" * 25, headers={"Retry-After": "99"})
        return httpx.Response(200, content=make_fits())

    sleeps = []
    fake = FakeIrsa(scenario(), cutout)
    result = find(adapter(tmp_path, fake, sleep=sleeps.append))
    assert len(result.cutouts) == 6 and result.summary.cutouts_failed == 0
    assert sleeps and set(sleeps) == {5.0}  # Retry-After: 99 se recorta a 5 s


def test_failed_candidates_are_replaced_but_attempts_are_capped_at_8(tmp_path):
    many = {DR1: votable([row(DR1, n, 3, 60000.0 + 40 * n) for n in range(1, 13)]), QR3: votable([])}  # 12 épocas
    fake = FakeIrsa(many, lambda req, n: httpx.Response(503, headers={"Retry-After": "0"}))
    with pytest.raises(IrsaUnavailable):  # fallos transitorios: reintentable, no «insuficiente»
        find(adapter(tmp_path, fake))
    assert fake.cutout_calls == 16  # 8 intentos x (1 + 1 reintento)


def test_one_good_replacement_after_two_failures(tmp_path):
    bad = set()

    def cutout(req, n):
        key = str(req.url).split("?")[0]
        if len(bad) < 2 and key not in bad:
            bad.add(key)
        return httpx.Response(503, headers={"Retry-After": "0"}) if key in bad else httpx.Response(200, content=make_fits())

    fake = FakeIrsa(scenario(), cutout)
    result = find(adapter(tmp_path, fake))
    assert len(result.cutouts) == 6 and result.summary.cutouts_failed == 2 and result.summary.cutouts_attempted == 8


def test_non_fits_bodies_are_discarded_not_reported_as_outage(tmp_path):
    fake = FakeIrsa(scenario(), lambda req, n: httpx.Response(200, content=b"x" * 25))
    result = find(adapter(tmp_path, fake))
    assert result.cutouts == () and result.summary.cutouts_failed == 8
    assert not (tmp_path / "raw").exists() or not list((tmp_path / "raw").rglob("*.fits"))


def test_oversized_cutouts_are_rejected_before_writing(tmp_path):
    fake = FakeIrsa(scenario())
    result = find(adapter(tmp_path, fake, max_cutout_bytes=5000))
    assert result.cutouts == ()
    assert not list((tmp_path / "raw").rglob("*"))


def test_slow_drip_hits_the_hard_deadline(tmp_path):
    def slow():
        def gen():
            for _ in range(100):
                time.sleep(0.05)
                yield b"<VOTABLE>"
        return httpx.Response(200, content=gen())

    fake = FakeIrsa({DR1: slow, QR3: slow})
    started = time.monotonic()
    with pytest.raises(IrsaTimeout):
        adapter(tmp_path, fake).find_cutouts(RA0, DEC0, deadline=time.monotonic() + 0.3)
    assert time.monotonic() - started < 2.0


# ------------------------------------------------ nunca un falso «sin cobertura»
def test_both_collections_empty_is_a_genuine_no_observations(tmp_path):
    fake = FakeIrsa({DR1: votable([]), QR3: votable([])})
    result = find(adapter(tmp_path, fake))
    assert result.cutouts == () and result.summary.rows_returned == 0
    assert result.summary.collections_failed == () and not result.summary.truncated


@pytest.mark.parametrize("failure", [500, 503, 404, b"<html>basura</html>"])
def test_one_collection_failing_and_the_other_empty_is_never_no_coverage(tmp_path, failure):
    fake = FakeIrsa({DR1: failure, QR3: votable([])})
    with pytest.raises(IrsaUnavailable):
        find(adapter(tmp_path, fake))


def test_one_collection_failing_with_usable_data_is_flagged_incomplete(tmp_path):
    sia = scenario()
    sia[QR3] = 503
    result = find(adapter(tmp_path, FakeIrsa(sia)))
    assert len(result.cutouts) >= 2
    assert result.summary.collections_failed == (QR3,) and result.summary.truncated


def test_redirects_are_not_followed(tmp_path):
    redirect = lambda: httpx.Response(302, headers={"Location": "https://evil.example/x"})  # noqa: E731
    fake = FakeIrsa({DR1: redirect, QR3: redirect})
    with pytest.raises(IrsaUnavailable):
        find(adapter(tmp_path, fake))
    assert {r.url.host for r in fake.requests} == {"irsa.ipac.caltech.edu"}


# ------------------------------------------------------- concurrencia y logs
def test_outbound_concurrency_is_bounded(tmp_path):
    fake = FakeIrsa(scenario(), lambda req, n: (time.sleep(0.05), httpx.Response(200, content=make_fits()))[1])
    find(adapter(tmp_path, fake, outbound_concurrency=2, cutout_workers=3))
    assert 1 <= fake.max_inflight <= 2


def test_logs_carry_no_urls_queries_or_local_paths(tmp_path, caplog):
    caplog.set_level(logging.DEBUG)
    fake = FakeIrsa(scenario(), lambda req, n: httpx.Response(503, headers={"Retry-After": "0"}) if n % 3 == 0 else httpx.Response(200, content=make_fits()))
    find(adapter(tmp_path, fake))
    text = "\n".join(r.getMessage() for r in caplog.records)
    assert "irsa kind=" in text
    for forbidden in ("https://", "http://", "center=", "POS=", "COLLECTION=", "10.25", "-12.5", str(tmp_path), "ibe/data"):
        assert forbidden not in text


def test_time_budgets_nest_under_the_route_and_cloudfront_limits():
    from planetx.http.factory import DEFAULT_LIVE_TIMEOUT_S

    assert IrsaConfig().budget_s < DEFAULT_LIVE_TIMEOUT_S < 30.0  # CloudFront corta a los 30 s por defecto
    assert (IrsaConfig().budget_s, DEFAULT_LIVE_TIMEOUT_S) == (22.0, 25.0)


def test_detector_lives_in_the_cutout_key_not_in_the_observation_id(tmp_path):
    from planetx.irsa.sia2 import Candidate

    ad = adapter(tmp_path, FakeIrsa({}))
    same_exposure = [
        Candidate("dr1", "SYNTH001_1A_0001_1", det, f"https://irsa.ipac.caltech.edu/x{det}.fits", 60000.0, 1.0)
        for det in (2, 5)
    ]
    assert len({c.observation_id for c in same_exposure}) == 1  # mismo OBSID
    paths = [ad._cache_path(c, RA0, DEC0) for c in same_exposure]
    assert paths[0] != paths[1]  # no colisionan en la caché
    assert "_D2_" in paths[0].name and "_D5_" in paths[1].name  # el detector está en la clave del recorte
