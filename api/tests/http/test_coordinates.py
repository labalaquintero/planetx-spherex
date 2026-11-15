import pytest

from conftest import FakeCatalog, make_client, synthetic_prepared


def _client_and_catalog():
    # Catálogo con payload preparado sintético: si la validación falla, no se llama.
    catalog = FakeCatalog(synthetic_prepared())
    return make_client(prepared=catalog), catalog


@pytest.mark.parametrize(
    ("ra", "dec"),
    [
        ("0", "0"),
        ("0.0", "-90"),
        ("359.9999", "90"),
        ("10.25", "-12.5"),
        ("+10.25", "+5"),
        (".5", "5."),
    ],
)
def test_valid_coordinates(ra, dec):
    client, catalog = _client_and_catalog()
    response = client.get("/api/v1/comparisons", params={"ra_deg": ra, "dec_deg": dec})
    assert response.status_code == 200
    assert catalog.calls == [{"ra_deg": float(ra), "dec_deg": float(dec), "fov_deg": 0.1, "science_version": "v1"}]


@pytest.mark.parametrize(
    "ra",
    ["", "nan", "NaN", "inf", "-inf", "Infinity", "1e999", "1e1", "1_0", "0x10", "1,5", " 10", "10 ", "abc", "--1",
     "360", "360.0", "-0.0001", "400", "١٠"],
)
def test_invalid_ra(ra):
    client, catalog = _client_and_catalog()
    response = client.get("/api/v1/comparisons", params={"ra_deg": ra, "dec_deg": "0"})
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "invalid_coordinates"
    assert body["error"]["message"]
    assert set(body) == {"error"}
    assert catalog.calls == []


@pytest.mark.parametrize("dec", ["", "nan", "-Infinity", "90.0001", "-90.0001", "91", "x"])
def test_invalid_dec(dec):
    client, catalog = _client_and_catalog()
    response = client.get("/api/v1/comparisons", params={"ra_deg": "10", "dec_deg": dec})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_coordinates"
    assert catalog.calls == []


@pytest.mark.parametrize("query", ["", "?ra_deg=10", "?dec_deg=0", "?ra_deg=1&ra_deg=2&dec_deg=0"])
def test_missing_or_repeated_parameters(query):
    client, catalog = _client_and_catalog()
    response = client.get("/api/v1/comparisons" + query)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_coordinates"
    assert catalog.calls == []
