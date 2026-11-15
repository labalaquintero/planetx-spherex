import json
from pathlib import Path

import pytest

from planetx.catalog import (
    InvalidCatalogQueryError,
    ManifestCorruptError,
    ManifestNotFoundError,
    MissingProductError,
    get_prepared,
)

# PNG 1x1 mínimo válido para pruebas locales de integridad
PNG_1X1_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00\x00"
    b"\x00\x04\x00\x01\xf6\x178U\x00\x00\x00\x00IEND\xaeB`\x82"
)


@pytest.fixture
def sample_catalog(tmp_path: Path) -> tuple[Path, Path]:
    products_dir = tmp_path / "products"
    products_dir.mkdir()

    for frame_id in ("prep-wise0855-e1", "prep-wise0855-e2"):
        (products_dir / f"{frame_id}.png").write_bytes(PNG_1X1_BYTES)

    manifest_data = {
        "manifest_version": "1",
        "entries": [
            {
                "active": True,
                "schema_version": "1",
                "status": "ready",
                "reason": None,
                "mode": "prepared",
                "query": {
                    "ra_deg": 133.795129,
                    "dec_deg": -7.245147,
                    "frame": "ICRS",
                    "fov_deg": 0.1,
                },
                "band": {"center_um": 3.4, "tolerance_um": 0.15},
                "checked_at": "2026-11-14T15:30:00Z",
                "science_version": "v1",
                "warnings": [],
                "frames": [
                    {
                        "id": "prep-wise0855-e1",
                        "observed_at": "2025-05-10T02:15:00Z",
                        "release": "dr1",
                        "observation_id": "spherex-dr1-9001",
                        "source_url": "[https://irsa.ipac.caltech.edu/data/SPHEREx/dr1/9001.fits](https://irsa.ipac.caltech.edu/data/SPHEREx/dr1/9001.fits)",
                        "image_url": "/api/v1/images/prep-wise0855-e1",
                        "quality_flags": [],
                    },
                    {
                        "id": "prep-wise0855-e2",
                        "observed_at": "2025-11-12T06:40:00Z",
                        "release": "qr3",
                        "observation_id": "spherex-qr3-9044",
                        "source_url": "[https://irsa.ipac.caltech.edu/data/SPHEREx/qr3/9044.fits](https://irsa.ipac.caltech.edu/data/SPHEREx/qr3/9044.fits)",
                        "image_url": "/api/v1/images/prep-wise0855-e2",
                        "quality_flags": [],
                    },
                ],
            }
        ],
    }

    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(json.dumps(manifest_data, indent=2), encoding="utf-8")
    return manifest_path, products_dir


def test_get_prepared_exact_match_returns_contract_payload(
    sample_catalog: tuple[Path, Path],
) -> None:
    manifest_path, products_dir = sample_catalog

    result = get_prepared(
        ra_deg=133.795129,
        dec_deg=-7.245147,
        fov_deg=0.1,
        science_version="v1",
        manifest_path=manifest_path,
        products_dir=products_dir,
    )

    assert result is not None
    assert "active" not in result
    assert result["schema_version"] == "1"
    assert result["status"] == "ready"
    assert result["reason"] is None
    assert result["mode"] == "prepared"
    assert result["query"] == {
        "ra_deg": 133.795129,
        "dec_deg": -7.245147,
        "frame": "ICRS",
        "fov_deg": 0.1,
    }
    assert [f["id"] for f in result["frames"]] == ["prep-wise0855-e1", "prep-wise0855-e2"]
    assert result["frames"][0]["observed_at"] < result["frames"][1]["observed_at"]


def test_get_prepared_does_not_approximate_neighbor_coordinates(
    sample_catalog: tuple[Path, Path],
) -> None:
    manifest_path, products_dir = sample_catalog

    # Coordenada vecina cercana: NO debe devolver el caso preparado
    neighbor = get_prepared(
        ra_deg=133.7952,
        dec_deg=-7.245147,
        fov_deg=0.1,
        science_version="v1",
        manifest_path=manifest_path,
        products_dir=products_dir,
    )
    assert neighbor is None

    # Versión científica distinta: devuelve None
    other_version = get_prepared(
        ra_deg=133.795129,
        dec_deg=-7.245147,
        fov_deg=0.1,
        science_version="v2",
        manifest_path=manifest_path,
        products_dir=products_dir,
    )
    assert other_version is None


def test_get_prepared_returns_none_when_entry_revoked(
    sample_catalog: tuple[Path, Path],
) -> None:
    manifest_path, products_dir = sample_catalog
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    payload["entries"][0]["revoked"] = True
    manifest_path.write_text(json.dumps(payload), encoding="utf-8")

    result = get_prepared(
        ra_deg=133.795129,
        dec_deg=-7.245147,
        fov_deg=0.1,
        science_version="v1",
        manifest_path=manifest_path,
        products_dir=products_dir,
    )
    assert result is None


def test_get_prepared_raises_on_missing_png_product(
    sample_catalog: tuple[Path, Path],
) -> None:
    manifest_path, products_dir = sample_catalog
    (products_dir / "prep-wise0855-e2.png").unlink()

    with pytest.raises(MissingProductError, match="prep-wise0855-e2"):
        get_prepared(
            ra_deg=133.795129,
            dec_deg=-7.245147,
            fov_deg=0.1,
            science_version="v1",
            manifest_path=manifest_path,
            products_dir=products_dir,
        )


def test_get_prepared_raises_on_corrupt_manifest_or_non_chronological_frames(
    sample_catalog: tuple[Path, Path],
) -> None:
    manifest_path, products_dir = sample_catalog
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))

    # Invertir orden cronológico de épocas debe fallar validación de integridad
    payload["entries"][0]["frames"].reverse()
    manifest_path.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(ManifestCorruptError, match="orden cronológico"):
        get_prepared(
            ra_deg=133.795129,
            dec_deg=-7.245147,
            fov_deg=0.1,
            science_version="v1",
            manifest_path=manifest_path,
            products_dir=products_dir,
        )

    # JSON roto
    manifest_path.write_text("{corrupt-json", encoding="utf-8")
    with pytest.raises(ManifestCorruptError):
        get_prepared(
            ra_deg=133.795129,
            dec_deg=-7.245147,
            fov_deg=0.1,
            science_version="v1",
            manifest_path=manifest_path,
            products_dir=products_dir,
        )


def test_get_prepared_raises_when_configured_manifest_missing(tmp_path: Path) -> None:
    with pytest.raises(ManifestNotFoundError):
        get_prepared(
            ra_deg=10.25,
            dec_deg=-12.5,
            manifest_path=tmp_path / "no_existe.json",
        )


def test_get_prepared_rejects_invalid_coordinates() -> None:
    with pytest.raises(InvalidCatalogQueryError):
        get_prepared(ra_deg=360.0, dec_deg=0.0)
    with pytest.raises(InvalidCatalogQueryError):
        get_prepared(ra_deg=10.0, dec_deg=-91.0)
    with pytest.raises(InvalidCatalogQueryError):
        get_prepared(ra_deg=float("nan"), dec_deg=0.0)