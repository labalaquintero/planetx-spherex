import pytest

from conftest import TINY_PNG, make_client


@pytest.fixture
def products(tmp_path):
    root = tmp_path / "products"
    root.mkdir()
    (root / "frame-1.png").write_bytes(TINY_PNG)
    (root / "notpng.png").write_bytes(b"esto no es un PNG")
    # Archivo "secreto" fuera de la raíz de productos: jamás debe servirse.
    (tmp_path / "secret.png").write_bytes(TINY_PNG)
    (root / "link.png").symlink_to(tmp_path / "secret.png")
    return root


def test_png_served_from_products_dir(products):
    response = make_client(products_dir=products).get("/api/v1/images/frame-1")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.content == TINY_PNG


def test_unknown_id_is_404_image_not_found(products):
    response = make_client(products_dir=products).get("/api/v1/images/desconocido")
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "image_not_found", "message": "Imagen no encontrada."}}


@pytest.mark.parametrize(
    "frame_id",
    [
        "..%2Fsecret",
        "%2e%2e%2fsecret",
        "..%2F..%2Fetc%2Fpasswd",
        "%2Fetc%2Fpasswd",
        "http%3A%2F%2Fevil.example%2Fx",
        "file%3A%2F%2F%2Fetc%2Fpasswd",
        "frame-1%5C..%5Csecret",
        "frame-1%00",
        "secret",
        "frame-1.png",
    ],
)
def test_client_paths_and_urls_are_never_resolved(products, frame_id):
    response = make_client(products_dir=products).get(f"/api/v1/images/{frame_id}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "image_not_found"


def test_symlink_escaping_root_and_non_png_are_not_served(products):
    client = make_client(products_dir=products)
    assert client.get("/api/v1/images/link").status_code == 404
    assert client.get("/api/v1/images/notpng").status_code == 404
