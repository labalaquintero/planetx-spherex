import pytest

from irsa_helpers import DEC0, RA0, access_url, row, votable
from planetx.irsa.config import IrsaConfig
from planetx.irsa.errors import IrsaUnavailable
from planetx.irsa.selection import select_candidates
from planetx.irsa.sia2 import Candidate, build_params, parse_votable

CFG = IrsaConfig()
DR1, QR3 = "spherex_dr1", "spherex_qr3"


def parse(rows, collection=DR1, status="OK"):
    return parse_votable(votable(rows, status), collection, RA0, DEC0, CFG)


def test_query_params_match_pyvo_serialization():
    assert build_params(DR1, 10.25, -12.5, CFG) == {
        "COLLECTION": "spherex_dr1",
        "POS": "CIRCLE 10.25000000 -12.50000000 0.05",
        "MAXREC": "2000",
    }


def test_rows_are_parsed_deduplicated_and_filtered():
    rows = [
        row(DR1, 1, 3, 60000.0),
        row(DR1, 1, 3, 60000.0),  # duplicado exacto (obs_id, detector)
        row(DR1, 1, 6, 60000.0),  # misma exposición, otro detector: se conserva
        row(DR1, 2, 3, 60100.0, access_format="text/html"),
        row(DR1, 3, 3, 60200.0, calib_level=1),
        row(DR1, 4, 3, 60300.0, energy_bandpassname="SPHEREx-D9"),
        row(DR1, 5, 3, 60400.0, access_url="https://evil.example/x.fits"),
        row(DR1, 6, 3, 60500.0, obs_collection="spherex_qr3"),
        row(DR1, 7, 3, 60600.0, s_region="CIRCLE ICRS 1 2 3"),
    ]
    result = parse(rows)

    assert result.rows == 9
    assert [(c.obs_id, c.detector) for c in result.candidates] == [("SYNTH001_1A_0001_1", 3), ("SYNTH001_1A_0001_1", 6)]
    first = result.candidates[0]
    assert first.observation_id == "SYNTH001_1A_0001_1/D3" and first.release == "dr1"
    assert first.observed_at.isoformat() == "2023-02-25T00:00:00+00:00"  # MJD 60000.0 -> 2023-02-25
    assert first.margin_deg == pytest.approx(1.7, abs=0.02)
    assert not result.overflow


def test_same_instant_in_two_detectors_is_not_a_duplicate_epoch():
    # En las muestras reales los detectores de una exposición difieren 1 ms: no se deduplica por fecha.
    result = parse([row(DR1, 1, 2, 60000.0), row(DR1, 1, 5, 60000.0 + 1e-8)])
    assert len(result.candidates) == 2


def test_overflow_and_error_status():
    assert parse([row(DR1, 1, 3, 60000.0)], status="OVERFLOW").overflow is True
    with pytest.raises(IrsaUnavailable):
        parse([], status="ERROR")


@pytest.mark.parametrize("body", [b"", b"<html>no es votable</html>", b"\x00\x01\x02", votable([])[:80]])
def test_unreadable_votable_is_unavailable_not_empty(body):
    with pytest.raises(IrsaUnavailable):
        parse_votable(body, DR1, RA0, DEC0, CFG)


def test_missing_columns_is_unavailable():
    broken = votable([row(DR1, 1, 3, 60000.0)]).replace(b'name="s_region"', b'name="otra"')
    with pytest.raises(IrsaUnavailable):
        parse_votable(broken, DR1, RA0, DEC0, CFG)


# ------------------------------------------------------------------ selección
def cand(det, t, margin=1.0, n=None, release="dr1"):
    n = n if n is not None else int(t)
    return Candidate(release, f"SYNTH{n:05d}_1A_0001_1", det, access_url(release, n % 1000, det), t, margin)


def pick(cands, **kw):
    args = dict(min_margin_deg=0.0708, min_epoch_separation_days=1.0, max_attempts=8)
    return select_candidates(cands, **{**args, **kw})


def test_partial_coverage_rows_are_excluded():
    sel = pick([cand(3, 1000.0, margin=0.02), cand(3, 1010.0, margin=0.0709), cand(3, 1020.0, margin=-0.3)])
    assert [c.t_min_mjd for c in sel.ordered] == [1010.0] and sel.usable == 1


def test_one_detector_group_with_comparable_epochs_and_largest_span():
    sel = pick([cand(2, 1000.0), cand(2, 1001.5), cand(5, 1000.0), cand(5, 1300.0), cand(6, 1000.0)])
    assert sel.detector == 5 and [c.t_min_mjd for c in sel.ordered] == [1000.0, 1300.0]


def test_repeats_within_the_same_visit_are_thinned():
    sel = pick([cand(3, 1000.0), cand(3, 1000.01), cand(3, 1000.02), cand(3, 1100.0)])
    assert sel.epochs_available == 2 and len(sel.ordered) == 2


def test_order_is_extremes_first_then_spread_and_capped():
    times = [1000.0 + 10 * i for i in range(30)]
    sel = pick([cand(3, t) for t in times], max_attempts=8)
    ordered = [c.t_min_mjd for c in sel.ordered]
    assert ordered[:2] == [1000.0, 1290.0] and ordered[2] == 1140.0
    assert len(ordered) == 8 and len(set(ordered)) == 8
    assert sel.epochs_available == 30


def test_nothing_usable_returns_empty_selection():
    sel = pick([cand(3, 1000.0, margin=0.0)])
    assert sel.ordered == () and sel.usable == 0 and sel.detector is None
