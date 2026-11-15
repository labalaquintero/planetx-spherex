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


# Parámetros y fotogramas oficiales aprobados para WISE 0855
WISE0855_RA = 133.795129166667
WISE0855_DEC = -7.245147222222
WISE0855_FOV = 0.1
WISE0855_VERSION = "v1"
FRAME_ID_E1 = "c80d7aae12e197e3f2678239871ca47d198813c567550ff12549b7cc6feddb9c"
FRAME_ID_E2 = "ec0f084def6975d7ddaac0af157ec0f0df5dbf01f46e183461939d8af33c4033"


@pytest.fixture
def sample_catalog(tmp_path: Path) -> tuple[Path, Path]:
    products_dir = tmp_path / "products"
    products_dir.mkdir()

    for frame_id in (FRAME_ID_E1, FRAME_ID_E2):
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
                    "ra_deg": WISE0855_RA,
                    "dec_deg": WISE0855_DEC,
                    "frame": "ICRS",
                    "fov_deg": WISE0855_FOV,
                },
                "band": {
                    "center_um": 0.9928165220816996,
                    "tolerance_um": 0.012909112710767471,
                },
                "checked_at": "2026-11-14T15:30:00Z",
                "science_version": WISE0855_VERSION,
                "warnings": [],
                "frames": [
                    {
                        "id": FRAME_ID_E1,
                        "observed_at": "2025-05-06T12:20:24.888Z",
                        "release": "dr1",
                        "observation_id": "2025W19_1B_0241_1",
                        "source_url": "https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/2025W19_1B/l2b-v27-2026-197/1/level2_2025W19_1B_0241_1D1_spx_l2b-v27-2026-197.fits",
                        "image_url": f"/api/v1/images/{FRAME_ID_E1}",
                        "quality_flags": ["masked_pixels"],
                    },
                    {
                        "id": FRAME_ID_E2,
                        "observed_at": "2025-10-31T18:55:38.358Z",
                        "release": "dr1",
                        "observation_id": "2025W44_2B_0322_1",
                        "source_url": "https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/2025W44_2B/l2b-v27-2026-246/1/level2_2025W44_2B_0322_1D1_spx_l2b-v27-2026-246.fits",
                        "image_url": f"/api/v1/images/{FRAME_ID_E2}",
                        "quality_flags": ["masked_pixels"],
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
        ra_deg=WISE0855_RA,
        dec_deg=WISE0855_DEC,
        fov_deg=WISE0855_FOV,
        science_version=WISE0855_VERSION,
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
        "ra_deg": WISE0855_RA,
        "dec_deg": WISE0855_DEC,
        "frame": "ICRS",
        "fov_deg": WISE0855_FOV,
    }
    assert result["band"] == {
        "center_um": 0.9928165220816996,
        "tolerance_um": 0.012909112710767471,
    }
    assert [f["id"] for f in result["frames"]] == [FRAME_ID_E1, FRAME_ID_E2]
    assert result["frames"][0]["observed_at"] < result["frames"][1]["observed_at"]
    assert result["frames"][0]["release"] == "dr1"
    assert result["frames"][1]["release"] == "dr1"


def test_get_prepared_rejects_rounded_wise0855_coordinates(
    sample_catalog: tuple[Path, Path],
) -> None:
    manifest_path, products_dir = sample_catalog

    # Coordenadas redondeadas a 6 decimales: NO deben coincidir (devuelven None)
    rounded = get_prepared(
        ra_deg=133.795129,
        dec_deg=-7.245147,
        fov_deg=0.1,
        science_version="v1",
        manifest_path=manifest_path,
        products_dir=products_dir,
    )
    assert rounded is None


def test_get_prepared_does_not_approximate_neighbor_coordinates(
    sample_catalog: tuple[Path, Path],
) -> None:
    manifest_path, products_dir = sample_catalog

    # Coordenada vecina cercana: NO debe devolver el caso preparado
    neighbor = get_prepared(
        ra_deg=133.7952,
        dec_deg=WISE0855_DEC,
        fov_deg=WISE0855_FOV,
        science_version=WISE0855_VERSION,
        manifest_path=manifest_path,
        products_dir=products_dir,
    )
    assert neighbor is None

    # Versión científica distinta: devuelve None
    other_version = get_prepared(
        ra_deg=WISE0855_RA,
        dec_deg=WISE0855_DEC,
        fov_deg=WISE0855_FOV,
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
        ra_deg=WISE0855_RA,
        dec_deg=WISE0855_DEC,
        fov_deg=WISE0855_FOV,
        science_version=WISE0855_VERSION,
        manifest_path=manifest_path,
        products_dir=products_dir,
    )
    assert result is None


def test_get_prepared_raises_on_missing_png_product(
    sample_catalog: tuple[Path, Path],
) -> None:
    manifest_path, products_dir = sample_catalog
    (products_dir / f"{FRAME_ID_E2}.png").unlink()

    with pytest.raises(MissingProductError, match=FRAME_ID_E2):
        get_prepared(
            ra_deg=WISE0855_RA,
            dec_deg=WISE0855_DEC,
            fov_deg=WISE0855_FOV,
            science_version=WISE0855_VERSION,
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
            ra_deg=WISE0855_RA,
            dec_deg=WISE0855_DEC,
            fov_deg=WISE0855_FOV,
            science_version=WISE0855_VERSION,
            manifest_path=manifest_path,
            products_dir=products_dir,
        )

    # JSON roto
    manifest_path.write_text("{corrupt-json", encoding="utf-8")
    with pytest.raises(ManifestCorruptError):
        get_prepared(
            ra_deg=WISE0855_RA,
            dec_deg=WISE0855_DEC,
            fov_deg=WISE0855_FOV,
            science_version=WISE0855_VERSION,
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


def test_get_prepared_validates_frame_id_format(
    sample_catalog: tuple[Path, Path],
) -> None:
    manifest_path, products_dir = sample_catalog

    # IDs que deben ser rechazados por la regex ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$
    invalid_ids = [
        "frame 1",        # espacio
        ".frame",         # empieza con punto
        "-frame",         # empieza con guión
        "_frame",         # empieza con guión bajo
        "a" * 129,        # longitud > 128
        "frame/traversal",  # barra
        "frame\\back",    # backslash
    ]

    for bad_id in invalid_ids:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
        payload["entries"][0]["frames"][0]["id"] = bad_id
        payload["entries"][0]["frames"][0]["image_url"] = f"/api/v1/images/{bad_id}"
        manifest_path.write_text(json.dumps(payload), encoding="utf-8")

        # No intentamos crear el PNG: la validación del frame_id falla antes
        # de acceder al sistema de archivos, y algunos IDs inválidos (con / o \)
        # no son nombres de archivo válidos en Windows.
        with pytest.raises(ManifestCorruptError, match="Identificador de fotograma"):
            get_prepared(
                ra_deg=WISE0855_RA,
                dec_deg=WISE0855_DEC,
                fov_deg=WISE0855_FOV,
                science_version=WISE0855_VERSION,
                manifest_path=manifest_path,
                products_dir=products_dir,
            )

    # IDs válidos: no deben lanzar error (restaurar manifiesto original)
    valid_ids = ["prep-wise0855-e1", "frame_01.v1", "A", "z0.test-id_OK"]
    for i, valid_id in enumerate(valid_ids):
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
        entry = payload["entries"][0]
        entry["frames"] = [
            {
                "id": valid_id,
                "observed_at": f"2025-05-1{i}T02:15:00Z",
                "release": "dr1",
                "observation_id": f"obs-valid-{i}",
                "source_url": f"https://example.com/dr1/{valid_id}.fits",
                "image_url": f"/api/v1/images/{valid_id}",
                "quality_flags": [],
            },
            {
                "id": f"epoch2-{i}",
                "observed_at": f"2025-11-1{i}T06:40:00Z",
                "release": "qr3",
                "observation_id": f"obs-valid-{i}-e2",
                "source_url": f"https://example.com/qr3/epoch2-{i}.fits",
                "image_url": f"/api/v1/images/epoch2-{i}",
                "quality_flags": [],
            },
        ]
        manifest_path.write_text(json.dumps(payload), encoding="utf-8")
        (products_dir / f"{valid_id}.png").write_bytes(PNG_1X1_BYTES)
        (products_dir / f"epoch2-{i}.png").write_bytes(PNG_1X1_BYTES)

        result = get_prepared(
            ra_deg=WISE0855_RA,
            dec_deg=WISE0855_DEC,
            fov_deg=WISE0855_FOV,
            science_version=WISE0855_VERSION,
            manifest_path=manifest_path,
            products_dir=products_dir,
        )
        assert result is not None
        assert result["frames"][0]["id"] == valid_id


def test_get_prepared_rejects_non_utc_or_incoherent_timestamps(
    sample_catalog: tuple[Path, Path],
) -> None:
    manifest_path, products_dir = sample_catalog

    invalid_timestamps = [
        "2025-05-06T12:20:24+02:00",  # offset no UTC
        "2025-05-06T12:20:24+00:00",  # falta sufijo Z explícito
        "2025-05-06 12:20:24Z",       # separador con espacio en vez de T
        "2025-05-06",                 # fecha sin hora
        "invalid-date",               # no fecha
    ]

    for bad_ts in invalid_timestamps:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
        payload["entries"][0]["frames"][0]["observed_at"] = bad_ts
        manifest_path.write_text(json.dumps(payload), encoding="utf-8")

        with pytest.raises(ManifestCorruptError, match="Formato ISO-8601 UTC estricto"):
            get_prepared(
                ra_deg=WISE0855_RA,
                dec_deg=WISE0855_DEC,
                fov_deg=WISE0855_FOV,
                science_version=WISE0855_VERSION,
                manifest_path=manifest_path,
                products_dir=products_dir,
            )

    # Incoherencia temporal: observed_at posterior a checked_at
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    payload["entries"][0]["frames"][0]["observed_at"] = "2025-05-06T12:20:24.888Z"
    payload["entries"][0]["checked_at"] = "2025-05-01T00:00:00Z"
    # frames[0].observed_at es "2025-05-06T12:20:24.888Z" (> 2025-05-01)
    manifest_path.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(ManifestCorruptError, match="Incoherencia temporal"):
        get_prepared(
            ra_deg=WISE0855_RA,
            dec_deg=WISE0855_DEC,
            fov_deg=WISE0855_FOV,
            science_version=WISE0855_VERSION,
            manifest_path=manifest_path,
            products_dir=products_dir,
        )


def test_get_prepared_validates_provenance_fields(
    sample_catalog: tuple[Path, Path],
) -> None:
    manifest_path, products_dir = sample_catalog

    # source_url faltante o no https:// en dr1/qr3
    invalid_urls = [
        None,
        "",
        "   ",
        "http://irsa.ipac.caltech.edu/test.fits",  # http rechazado en dr1
        "ftp://irsa.ipac.caltech.edu/test.fits",   # ftp rechazado
        "https:///sin-host.fits",                  # sin netloc
    ]

    for bad_url in invalid_urls:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
        payload["entries"][0]["frames"][0]["source_url"] = bad_url
        manifest_path.write_text(json.dumps(payload), encoding="utf-8")

        with pytest.raises(ManifestCorruptError, match="source_url"):
            get_prepared(
                ra_deg=WISE0855_RA,
                dec_deg=WISE0855_DEC,
                fov_deg=WISE0855_FOV,
                science_version=WISE0855_VERSION,
                manifest_path=manifest_path,
                products_dir=products_dir,
            )

    # Caso fixture: source_url puede ser None o http/https válido
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    payload["entries"][0]["frames"][0]["release"] = "fixture"
    payload["entries"][0]["frames"][0]["source_url"] = None
    payload["entries"][0]["frames"][1]["release"] = "fixture"
    payload["entries"][0]["frames"][1]["source_url"] = "http://localhost:8000/fixture.fits"
    manifest_path.write_text(json.dumps(payload), encoding="utf-8")

    res = get_prepared(
        ra_deg=WISE0855_RA,
        dec_deg=WISE0855_DEC,
        fov_deg=WISE0855_FOV,
        science_version=WISE0855_VERSION,
        manifest_path=manifest_path,
        products_dir=products_dir,
    )
    assert res is not None
    assert res["frames"][0]["source_url"] is None
    assert res["frames"][1]["source_url"] == "http://localhost:8000/fixture.fits"

    # Caso fixture con URL malformada
    payload["entries"][0]["frames"][1]["source_url"] = "ftp://localhost/fixture.fits"
    manifest_path.write_text(json.dumps(payload), encoding="utf-8")
    with pytest.raises(ManifestCorruptError, match="source_url inválido en frame fixture"):
        get_prepared(
            ra_deg=WISE0855_RA,
            dec_deg=WISE0855_DEC,
            fov_deg=WISE0855_FOV,
            science_version=WISE0855_VERSION,
            manifest_path=manifest_path,
            products_dir=products_dir,
        )

    # observation_id inválido
    invalid_obs_ids = [
        "obs 1",        # espacios
        "obs#1",        # símbolo no permitido
        "-obs-1",       # inicia con guión
        ".obs-1",       # inicia con punto
        "_obs-1",       # inicia con guión bajo
        "x" * 129,      # supera 128 caracteres
    ]
    for bad_obs in invalid_obs_ids:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
        payload["entries"][0]["frames"][0]["observation_id"] = bad_obs
        manifest_path.write_text(json.dumps(payload), encoding="utf-8")

        with pytest.raises(ManifestCorruptError, match="observation_id inválido"):
            get_prepared(
                ra_deg=WISE0855_RA,
                dec_deg=WISE0855_DEC,
                fov_deg=WISE0855_FOV,
                science_version=WISE0855_VERSION,
                manifest_path=manifest_path,
                products_dir=products_dir,
            )


def test_get_prepared_validates_science_and_schema_version(
    sample_catalog: tuple[Path, Path],
) -> None:
    manifest_path, products_dir = sample_catalog

    # Consulta con science_version malformado
    invalid_versions = [" v1 ", "v 1", "v1$", ".v1", "-v1", "_v1", "a" * 65]
    for bad_ver in invalid_versions:
        with pytest.raises(InvalidCatalogQueryError, match="science_version inválido"):
            get_prepared(
                ra_deg=WISE0855_RA,
                dec_deg=WISE0855_DEC,
                fov_deg=WISE0855_FOV,
                science_version=bad_ver,
                manifest_path=manifest_path,
                products_dir=products_dir,
            )

    # Entrada del manifiesto con science_version inválido
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    payload["entries"][0]["science_version"] = " v1 "
    manifest_path.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(ManifestCorruptError, match="science_version"):
        get_prepared(
            ra_deg=WISE0855_RA,
            dec_deg=WISE0855_DEC,
            fov_deg=WISE0855_FOV,
            science_version="v1",
            manifest_path=manifest_path,
            products_dir=products_dir,
        )

    # schema_version raíz distinto a "1" debe ser rechazado
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    payload["entries"][0]["science_version"] = "v1"
    payload["schema_version"] = "2"
    manifest_path.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(ManifestCorruptError, match="schema_version raíz"):
        get_prepared(
            ra_deg=WISE0855_RA,
            dec_deg=WISE0855_DEC,
            fov_deg=WISE0855_FOV,
            science_version="v1",
            manifest_path=manifest_path,
            products_dir=products_dir,
        )

    # schema_version raíz == "1" es válido
    payload["schema_version"] = "1"
    manifest_path.write_text(json.dumps(payload), encoding="utf-8")
    res = get_prepared(
        ra_deg=WISE0855_RA,
        dec_deg=WISE0855_DEC,
        fov_deg=WISE0855_FOV,
        science_version="v1",
        manifest_path=manifest_path,
        products_dir=products_dir,
    )
    assert res is not None