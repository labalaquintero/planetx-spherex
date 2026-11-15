import threading

import anyio
import httpx
import pytest

from conftest import FakeCatalog, FakeScience, make_client, synthetic
from planetx.http import create_app
from planetx.http.errors import ArchiveUnavailable, QueryTimeout
from planetx.http.services import SequenceResult

PARAMS = {"ra_deg": "10.25", "dec_deg": "-12.5"}


def test_archive_unavailable_is_retryable_503_and_not_no_coverage():
    science = FakeScience(error=ArchiveUnavailable())
    response = make_client(prepared=FakeCatalog(None), science=science).get("/api/v1/comparisons", params=PARAMS)

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "archive_unavailable"
    assert response.headers["retry-after"]
    assert "no_coverage" not in response.text


def test_service_raised_query_timeout_is_503():
    science = FakeScience(error=QueryTimeout())
    response = make_client(prepared=FakeCatalog(None), science=science).get("/api/v1/comparisons", params=PARAMS)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "query_timeout"


def test_slow_live_service_hits_time_budget_as_query_timeout():
    release = threading.Event()

    class Slow:
        def build_sequence(self, **_):
            release.wait(5)
            raise AssertionError("no debería publicarse")

    try:
        client = make_client(prepared=FakeCatalog(None), science=Slow(), live_timeout_s=0.05)
        response = client.get("/api/v1/comparisons", params=PARAMS)
    finally:
        release.set()

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "query_timeout"
    assert response.headers["retry-after"]
    assert "no_coverage" not in response.text


def test_unexpected_error_is_500_without_leaking_paths_or_credentials():
    secret = RuntimeError("fallo en /home/usuario/.aws/credentials password=hunter2 token=abc123")
    client = make_client(prepared=FakeCatalog(error=secret))
    response = client.get("/api/v1/comparisons", params=PARAMS)

    assert response.status_code == 500
    body = response.json()
    assert body["error"]["code"] == "internal_error"
    for leaked in ("/home", "credentials", "hunter2", "abc123", "Traceback"):
        assert leaked not in response.text


def test_unknown_route_and_wrong_method_use_error_shape(client):
    missing = client.get("/api/v1/nope")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "not_found"

    wrong = client.post("/api/health")
    assert wrong.status_code == 405
    assert wrong.json()["error"]["code"] == "method_not_allowed"


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_live_concurrency_limit_rejects_without_starting_more_threads():
    entered = threading.Event()
    release = threading.Event()
    started_threads = []

    class Blocking:
        def build_sequence(self, **_):
            started_threads.append(threading.get_ident())
            entered.set()
            release.wait(5)
            return SequenceResult(payload=synthetic(), images={})

    app = create_app(
        prepared=FakeCatalog(None), science=Blocking(), live_concurrency=1, allow_fixtures=True
    )
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        first_result = {}

        async def first_request():
            first_result["response"] = await client.get("/api/v1/comparisons", params=PARAMS)

        async with anyio.create_task_group() as tg:
            tg.start_soon(first_request)
            with anyio.fail_after(3):
                while not entered.is_set():
                    await anyio.sleep(0.01)

            # Cupo lleno: rechazo inmediato y reintentable, sin otro hilo.
            second = await client.get("/api/v1/comparisons", params=PARAMS)
            assert second.status_code == 503
            assert second.json()["error"]["code"] == "archive_unavailable"
            assert second.headers["retry-after"]
            assert len(started_threads) == 1

            release.set()

        assert first_result["response"].status_code == 200

        # El cupo se liberó al terminar el hilo: una nueva petición entra.
        third = await client.get("/api/v1/comparisons", params=PARAMS)
        assert third.status_code == 200
        assert len(started_threads) == 2
