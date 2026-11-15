"""Integración con ``planetx.catalog`` (DeValle). Datos SINTÉTICOS: el JSON de §5, marcado.

Las pruebas con módulo simulado no dependen del catálogo real; las de «catálogo real» se omiten
si ``planetx.catalog`` no está en el árbol (p. ej. antes de integrar ``origin/main``).
"""

import json
import logging
import sys
import types

import pytest

from conftest import TINY_PNG, FakeScience, make_client, synthetic
from planetx.http import create_app
from planetx.http.catalog_adapter import CatalogAdapter, load_catalog_module
from planetx.http.factory import REPO_ROOT, resolve_catalog_manifest, resolve_products_dir

PARAMS = {"ra_deg": "10.25", "dec_deg": "-12.5"}


# ----------------------------------------------------------- importación diferida
def test_api_starts_and_serves_without_planetx_catalog(monkeypatch):
    monkeypatch.setitem(sys.modules, "planetx.catalog", None)  # simula que el módulo no existe
    assert load_catalog_module() is None

    client = make_client()
    assert client.get("/api/health").json() == {"status": "ok"}
    response = client.get("/api/v1/comparisons", params=PARAMS)
    assert response.status_code == 503 and response.json()["error"]["code"] == "archive_unavailable"


def test_broken_import_inside_an_existing_catalog_is_not_swallowed(monkeypatch):
    def boom(name):
        raise ModuleNotFoundError("No module named 'otra_dependencia'", name="otra_dependencia")

    monkeypatch.setattr("planetx.http.catalog_adapter.importlib.import_module", boom)
    with pytest.raises(ModuleNotFoundError):
        load_catalog_module()


# ------------------------------------------------------------- mapeo de errores
class _InvalidQuery(ValueError): ...
class _Integrity(Exception): ...
class _ManifestNotFound(_Integrity): ...
class _MissingProduct(_Integrity): ...


def fake_module(fn):
    return types.SimpleNamespace(
        get_prepared=fn, InvalidCatalogQueryError=_InvalidQuery, CatalogIntegrityError=_Integrity
    )


def client_for(fn, tmp_path, **kw):
    adapter = CatalogAdapter(fake_module(fn), manifest_path=tmp_path / "m.json", products_dir=tmp_path / "p")
    return make_client(prepared=adapter, **kw)


def test_none_goes_live_and_explicit_paths_are_forwarded(tmp_path):
    seen = {}

    def get_prepared(**kwargs):
        seen.update(kwargs)
        return None

    science = FakeScience(synthetic(), images={})
    response = client_for(get_prepared, tmp_path, science=science, allow_fixtures=True).get("/api/v1/comparisons", params=PARAMS)

    assert response.status_code == 200 and response.json()["mode"] == "fixture" and len(science.calls) == 1
    assert seen == {
        "ra_deg": 10.25, "dec_deg": -12.5, "fov_deg": 0.1, "science_version": "v1",
        "manifest_path": tmp_path / "m.json", "products_dir": tmp_path / "p",
    }


def test_invalid_query_is_422(tmp_path):
    def get_prepared(**_):
        raise _InvalidQuery("ra_deg debe estar en el rango [0, 360).")

    response = client_for(get_prepared, tmp_path).get("/api/v1/comparisons", params=PARAMS)
    assert response.status_code == 422 and response.json()["error"]["code"] == "invalid_coordinates"


@pytest.mark.parametrize("exc_type", [_Integrity, _ManifestNotFound, _MissingProduct])
def test_integrity_errors_are_logged_and_500_never_no_coverage(tmp_path, caplog, exc_type):
    def get_prepared(**_):
        raise exc_type("PNG faltante: /home/usuario/secreto/products/frame-x.png")

    caplog.set_level(logging.ERROR, logger="planetx.http")
    response = client_for(get_prepared, tmp_path).get("/api/v1/comparisons", params=PARAMS)

    assert response.status_code == 500 and response.json()["error"]["code"] == "internal_error"
    for leaked in ("/home", "secreto", "frame-x", "no_coverage"):
        assert leaked not in response.text
    assert any(exc_type.__name__ in r.getMessage() for r in caplog.records)  # el detalle queda en logs


# ------------------------------------------------ una sola regla de directorios
def test_products_dir_rule(monkeypatch, tmp_path):
    manifest = tmp_path / "cat" / "manifest.json"
    assert resolve_products_dir() == REPO_ROOT / "data" / "products"  # sin manifiesto
    assert resolve_products_dir(manifest=manifest) == tmp_path / "cat" / "products"  # default del catálogo
    assert resolve_products_dir("data/otros") == REPO_ROOT / "data" / "otros"  # relativo => raíz del repo
    monkeypatch.setenv("PLANETX_PRODUCTS_DIR", str(tmp_path / "explicito"))
    assert resolve_products_dir(manifest=manifest) == tmp_path / "explicito"  # explícito gana
    monkeypatch.setenv("PLANETX_CATALOG_MANIFEST", "data/manifest.json")
    assert resolve_catalog_manifest() == REPO_ROOT / "data" / "manifest.json"


def test_warning_when_manifest_has_no_explicit_products_dir(monkeypatch, tmp_path, caplog):
    caplog.set_level(logging.WARNING, logger="planetx.http")
    create_app(catalog_manifest=tmp_path / "manifest.json")
    assert any("PLANETX_PRODUCTS_DIR" in r.getMessage() for r in caplog.records)

    caplog.clear()
    create_app(catalog_manifest=tmp_path / "manifest.json", products_dir=tmp_path / "png")
    monkeypatch.setenv("PLANETX_PRODUCTS_DIR", str(tmp_path / "png"))
    create_app(catalog_manifest=tmp_path / "manifest.json")
    assert not any("PLANETX_PRODUCTS_DIR no está definido" in r.getMessage() for r in caplog.records)


# ---------------------------------------------------- catálogo REAL (se omite si falta)
@pytest.fixture
def real_catalog():
    return pytest.importorskip("planetx.catalog")


def write_catalog(root, ids=("synthetic-a", "synthetic-b"), entry=None):
    """Manifiesto y PNG SINTÉTICOS en ``root``; devuelve (manifest, products)."""
    payload = entry or synthetic(mode="prepared")
    for frame, frame_id in zip(payload["frames"], ids):
        frame["id"], frame["image_url"] = frame_id, f"/api/v1/images/{frame_id}"
    products = root / "products"
    products.mkdir(parents=True)
    for i, frame_id in enumerate(ids):
        (products / f"{frame_id}.png").write_bytes(TINY_PNG + bytes([i]))  # bytes distintos por fotograma
    manifest = root / "manifest.json"
    manifest.write_text(json.dumps({"entries": [payload]}))
    return manifest, products


def test_real_catalog_every_image_url_is_served_by_the_images_route(real_catalog, tmp_path):
    manifest, products = write_catalog(tmp_path)
    client = make_client(catalog_manifest=manifest, products_dir=products)

    response = client.get("/api/v1/comparisons", params=PARAMS)

    assert response.status_code == 200 and response.json()["mode"] == "prepared"
    frames = response.json()["frames"]
    assert len(frames) == 2
    for frame in frames:
        image = client.get(frame["image_url"])  # la misma ruta que anuncia el payload
        assert image.status_code == 200 and image.headers["content-type"] == "image/png"
        assert image.content == (products / f"{frame['id']}.png").read_bytes()


def test_real_catalog_default_products_dir_follows_the_manifest(real_catalog, tmp_path):
    manifest, _ = write_catalog(tmp_path)
    client = make_client(catalog_manifest=manifest)  # sin PLANETX_PRODUCTS_DIR: <manifiesto>/products
    for frame in client.get("/api/v1/comparisons", params=PARAMS).json()["frames"]:
        assert client.get(frame["image_url"]).status_code == 200


def test_real_catalog_unknown_pair_is_not_a_false_no_coverage(real_catalog, tmp_path):
    manifest, products = write_catalog(tmp_path)
    response = make_client(catalog_manifest=manifest, products_dir=products).get(
        "/api/v1/comparisons", params={"ra_deg": "11", "dec_deg": "-12.5"}
    )
    assert response.status_code == 503 and "no_coverage" not in response.text  # sin vivo configurado


def test_real_catalog_missing_png_and_corrupt_manifest_are_500(real_catalog, tmp_path):
    manifest, products = write_catalog(tmp_path / "a")
    (products / "synthetic-b.png").unlink()
    missing = make_client(catalog_manifest=manifest, products_dir=products).get("/api/v1/comparisons", params=PARAMS)
    assert missing.status_code == 500 and missing.json()["error"]["code"] == "internal_error"
    assert str(tmp_path) not in missing.text and "no_coverage" not in missing.text

    manifest.write_text("{ esto no es json")
    corrupt = make_client(catalog_manifest=manifest, products_dir=products).get("/api/v1/comparisons", params=PARAMS)
    assert corrupt.status_code == 500 and corrupt.json()["error"]["code"] == "internal_error"


def test_real_catalog_accepts_ids_the_images_route_would_refuse(real_catalog, tmp_path):
    # El catálogo solo prohíbe «/», «\\» y «..»; la ruta de imágenes exige [A-Za-z0-9][A-Za-z0-9._-]*.
    # Se falla de forma explícita (500), no con una imagen inalcanzable. Propuesta a DeValle: alinear la regla.
    manifest, products = write_catalog(tmp_path, ids=("frame 1", "frame 2"))
    response = make_client(catalog_manifest=manifest, products_dir=products).get("/api/v1/comparisons", params=PARAMS)
    assert response.status_code == 500 and response.json()["error"]["code"] == "internal_error"
