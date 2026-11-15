from conftest import FakeCatalog, FakeScience, make_client, synthetic, synthetic_prepared

PARAMS = {"ra_deg": "10.25", "dec_deg": "-12.5"}


def test_prepared_path_is_served_and_live_is_not_called():
    catalog = FakeCatalog(synthetic_prepared())
    science = FakeScience(synthetic())
    client = make_client(prepared=catalog, science=science)

    response = client.get("/api/v1/comparisons", params=PARAMS)

    assert response.status_code == 200
    assert response.json()["mode"] == "prepared"
    assert len(response.json()["frames"]) == 2
    assert science.calls == []


def test_live_path_sets_mode_and_uses_same_center_and_serves_images():
    catalog = FakeCatalog(None)
    live = synthetic_prepared(mode="live")  # el servicio añade el modo; la ciencia no lo decide
    science = FakeScience(live, images={"synthetic-a": _png(), "synthetic-b": _png()})
    client = make_client(prepared=catalog, science=science)

    response = client.get("/api/v1/comparisons", params=PARAMS)

    assert response.status_code == 200
    assert response.json()["mode"] == "live"
    assert catalog.calls[0]["ra_deg"] == science.calls[0]["ra_deg"] == 10.25
    assert catalog.calls[0]["dec_deg"] == science.calls[0]["dec_deg"] == -12.5
    assert science.calls[0]["fov_deg"] == 0.1
    # Los PNG emitidos por ciencia quedan accesibles solo por su ID.
    assert client.get("/api/v1/images/synthetic-a").headers["content-type"] == "image/png"


def _png():
    from conftest import TINY_PNG

    return TINY_PNG


def test_insufficient_and_no_coverage_pass_through_unchanged():
    insufficient = synthetic_prepared(
        status="insufficient", reason="single_epoch", frames=synthetic_prepared()["frames"][:1]
    )
    no_coverage = synthetic_prepared(status="no_coverage", reason="no_observations", band=None, frames=[])
    for payload in (insufficient, no_coverage):
        client = make_client(prepared=FakeCatalog(payload))
        response = client.get("/api/v1/comparisons", params=PARAMS)
        assert response.status_code == 200
        assert response.json() == payload


def test_fixture_payload_is_blocked_by_default_and_allowed_in_dev():
    catalog = FakeCatalog(synthetic())  # mode == "fixture"

    blocked = make_client(prepared=catalog).get("/api/v1/comparisons", params=PARAMS)
    assert blocked.status_code == 500
    assert blocked.json()["error"]["code"] == "internal_error"

    allowed = make_client(prepared=catalog, allow_fixtures=True).get("/api/v1/comparisons", params=PARAMS)
    assert allowed.status_code == 200
    assert allowed.json()["mode"] == "fixture"


def test_image_url_must_be_same_origin_path():
    payload = synthetic_prepared()
    payload["frames"][0]["image_url"] = "https://evil.example/x.png"
    response = make_client(prepared=FakeCatalog(payload)).get("/api/v1/comparisons", params=PARAMS)
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"


def test_default_wiring_has_no_fixtures_and_fails_as_retryable_503():
    client = make_client()
    response = client.get("/api/v1/comparisons", params=PARAMS)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "archive_unavailable"
    assert client.get("/api/health").json() == {"status": "ok"}
