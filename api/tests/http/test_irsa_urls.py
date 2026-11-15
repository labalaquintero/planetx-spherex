import pytest

from irsa_helpers import HOST, RA0, DEC0, access_url, square_region
from planetx.irsa.config import IrsaConfig
from planetx.irsa.client import IrsaHttp
from planetx.irsa.errors import IrsaRejected
from planetx.irsa.geometry import edge_margin_deg, parse_region
from planetx.irsa.urls import build_cutout_url, ensure_allowed_host, validate_access_url

CFG = IrsaConfig()
GOOD = access_url("dr1", 1, 3)


def test_valid_access_url_and_retry_variant():
    assert validate_access_url(GOOD, "spherex_dr1", CFG) == GOOD
    retry = GOOD.replace("l2b-v27", "l2b_retry-v27")  # variante observada en IRSA (5 filas)
    assert validate_access_url(retry, "spherex_dr1", CFG) == retry


@pytest.mark.parametrize(
    "url",
    [
        GOOD.replace("https://", "http://"),
        GOOD.replace(HOST, "evil.example"),
        GOOD.replace(HOST, HOST + ".evil.example"),
        GOOD.replace(HOST, "user:pw@" + HOST),
        GOOD.replace(HOST, HOST + ":8443"),
        GOOD.replace(HOST, "evil.example/" + HOST + "/.."),
        GOOD + "?center=1,2d&size=0.1",
        GOOD + "#frag",
        GOOD.replace("/ibe/data/spherex/", "/ibe/data/other/"),
        GOOD.replace("/level2/", "/level2/../"),
        GOOD.replace(".fits", ".html"),
        GOOD + " ",
        "",
        None,
        "file:///etc/passwd",
    ],
)
def test_hostile_urls_are_rejected(url):
    with pytest.raises(IrsaRejected):
        validate_access_url(url, "spherex_dr1", CFG)


def test_release_must_match_collection():
    with pytest.raises(IrsaRejected):
        validate_access_url(access_url("qr3", 1, 3), "spherex_dr1", CFG)


def test_cutout_url_format_matches_verified_probe():
    url = build_cutout_url(GOOD, 269.452, 4.693, 0.1)
    assert url == f"{GOOD}?center=269.45200000,4.69300000d&size=0.1"


@pytest.mark.parametrize("bad", [(float("nan"), 0, 0.1), (1, float("inf"), 0.1), (1, 1, 0), (1, 1, -1)])
def test_cutout_url_rejects_bad_numbers(bad):
    with pytest.raises(IrsaRejected):
        build_cutout_url(GOOD, *bad)


def test_http_client_refuses_foreign_host_without_sending(monkeypatch):
    import httpx

    calls = []
    http = IrsaHttp(CFG, transport=httpx.MockTransport(lambda r: calls.append(r) or httpx.Response(200)))
    with pytest.raises(IrsaRejected):
        http.get("https://evil.example/x", kind="test", max_bytes=10, deadline=1e12)
    ensure_allowed_host(GOOD, CFG)
    assert calls == []


def test_margin_positive_inside_negative_outside_and_wrapped_polygon():
    inside = parse_region(square_region(RA0, DEC0, 0.5))
    assert edge_margin_deg(inside, RA0, DEC0) == pytest.approx(0.5, abs=0.01)
    shifted = parse_region(square_region(RA0, DEC0 + 0.55, 0.5))  # el centro queda 0,05° fuera
    assert edge_margin_deg(shifted, RA0, DEC0) == pytest.approx(-0.05, abs=0.01)
    assert parse_region("POLYGON ICRS 1 2 3") is None and parse_region(None) is None
    assert parse_region("CIRCLE ICRS 1 2 3") is None
