"""Suite determinista de control de calidad de datos (Rol: César — F01).

Verifica sin conexión a internet ni llamadas a IRSA:
1. Integridad del esquema JSON v1 en todos los fixtures de `fixtures/data_qa/*.json`.
2. Reglas de negocio y consistencia por estado (`ready`, `insufficient`, `no_coverage`).
3. Consistencia y trazabilidad de la evidencia de los 5 casos del reto en
   `docs/qa/datos/matriz_5_casos.md` y `docs/qa/datos/evidencia_cruda_irsa.csv`.
"""

from __future__ import annotations

import csv
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURES_DIR = REPO_ROOT / "fixtures" / "data_qa"
DOCS_QA_DIR = REPO_ROOT / "docs" / "qa" / "datos"
MATRIZ_MD_PATH = DOCS_QA_DIR / "matriz_5_casos.md"
EVIDENCIA_CSV_PATH = DOCS_QA_DIR / "evidencia_cruda_irsa.csv"

EXPECTED_FIXTURE_FILES = [
    "qa_01_dos_epocas_ready.json",
    "qa_02_fecha_repetida_dedup.json",
    "qa_03_una_epoca_insufficient.json",
    "qa_04_incompatibilidad_espectral.json",
    "qa_05_sin_cobertura.json",
]

VALID_INSUFFICIENT_REASONS = {
    "single_epoch",
    "no_common_band",
    "no_usable_frames",
    "search_limit_reached",
}

ISO_UTC_Z_PATTERN = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$"
)


def _parse_iso_utc_z(value: Any) -> datetime:
    assert isinstance(value, str), f"Fecha UTC debe ser str, recibido: {type(value)}"
    assert ISO_UTC_Z_PATTERN.match(value), (
        f"Fecha '{value}' no cumple formato ISO-8601 UTC terminado en 'Z'"
    )
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    assert dt.tzinfo == timezone.utc
    return dt


def _assert_valid_icrs(ra_deg: Any, dec_deg: Any) -> None:
    assert isinstance(ra_deg, (int, float)) and not isinstance(ra_deg, bool)
    assert isinstance(dec_deg, (int, float)) and not isinstance(dec_deg, bool)
    assert math.isfinite(ra_deg), f"ra_deg no es finito: {ra_deg}"
    assert math.isfinite(dec_deg), f"dec_deg no es finito: {dec_deg}"
    assert 0.0 <= float(ra_deg) < 360.0, f"ra_deg fuera de [0, 360): {ra_deg}"
    assert -90.0 <= float(dec_deg) <= 90.0, f"dec_deg fuera de [-90, 90]: {dec_deg}"


def _load_all_fixtures() -> list[tuple[str, dict[str, Any]]]:
    files = sorted(FIXTURES_DIR.glob("*.json"))
    return [(f.name, json.loads(f.read_text(encoding="utf-8"))) for f in files]


def test_catalogo_completo_de_fixtures_qa() -> None:
    """Verifica que existan exactamente los 5 fixtures de control de calidad esperados."""
    assert FIXTURES_DIR.is_dir(), f"No existe el directorio {FIXTURES_DIR}"
    found_names = sorted(f.name for f in FIXTURES_DIR.glob("*.json"))
    assert found_names == sorted(EXPECTED_FIXTURE_FILES)


@pytest.mark.parametrize("fixture_name,payload", _load_all_fixtures())
def test_integridad_contrato_v1_comun(fixture_name: str, payload: dict[str, Any]) -> None:
    """Valida los campos comunes obligatorios del contrato JSON v1 en cada fixture QA."""
    required_top_keys = {
        "schema_version",
        "status",
        "reason",
        "mode",
        "query",
        "band",
        "checked_at",
        "science_version",
        "warnings",
        "frames",
    }
    assert required_top_keys.issubset(payload.keys()), (
        f"{fixture_name}: faltan claves requeridas del esquema v1"
    )
    assert payload["schema_version"] == "1"
    assert payload["mode"] == "fixture"
    assert payload["science_version"] == "v1"
    assert isinstance(payload["warnings"], list)

    _parse_iso_utc_z(payload["checked_at"])

    query = payload["query"]
    assert isinstance(query, dict)
    assert query.get("frame") == "ICRS"
    assert query.get("fov_deg") == 0.1
    _assert_valid_icrs(query.get("ra_deg"), query.get("dec_deg"))

    frames = payload["frames"]
    assert isinstance(frames, list)
    for frame in frames:
        assert isinstance(frame, dict)
        frame_keys = {
            "id",
            "observed_at",
            "release",
            "observation_id",
            "source_url",
            "image_url",
            "quality_flags",
        }
        assert frame_keys.issubset(frame.keys())
        assert isinstance(frame["id"], str) and frame["id"].strip() != ""
        _parse_iso_utc_z(frame["observed_at"])
        assert frame["release"] == "fixture"
        assert isinstance(frame["observation_id"], str) and frame["observation_id"].strip() != ""
        assert frame["source_url"] is None
        assert frame["image_url"] == f"/api/v1/images/{frame['id']}"
        assert isinstance(frame["quality_flags"], list)


@pytest.mark.parametrize("fixture_name,payload", _load_all_fixtures())
def test_reglas_de_negocio_por_estado(fixture_name: str, payload: dict[str, Any]) -> None:
    """Verifica las invariantes específicas de cada estado (`ready`, `insufficient`, `no_coverage`)."""
    status = payload["status"]
    reason = payload["reason"]
    band = payload["band"]
    frames = payload["frames"]

    assert status in {"ready", "insufficient", "no_coverage"}, (
        f"{fixture_name}: estado desconocido {status}"
    )

    if status == "ready":
        assert reason is None
        assert isinstance(band, dict), f"{fixture_name}: band no puede ser null en ready"
        assert isinstance(band.get("center_um"), (int, float)) and band["center_um"] > 0
        assert isinstance(band.get("tolerance_um"), (int, float)) and band["tolerance_um"] > 0
        assert 2 <= len(frames) <= 6, (
            f"{fixture_name}: ready requiere entre 2 y 6 fotogramas, tiene {len(frames)}"
        )

        observed_instants = [_parse_iso_utc_z(f["observed_at"]) for f in frames]
        for idx in range(len(observed_instants) - 1):
            assert observed_instants[idx] < observed_instants[idx + 1], (
                f"{fixture_name}: fotogramas no están en orden cronológico estricto o tienen fecha duplicada"
            )

        frame_ids = [f["id"] for f in frames]
        assert len(frame_ids) == len(set(frame_ids)), (
            f"{fixture_name}: IDs de fotogramas duplicados"
        )
        for f in frames:
            assert f["image_url"] == f"/api/v1/images/{f['id']}"

    elif status == "insufficient":
        assert reason in VALID_INSUFFICIENT_REASONS, (
            f"{fixture_name}: reason inválido '{reason}' para status='insufficient'"
        )
        assert len(frames) <= 1, (
            f"{fixture_name}: status='insufficient' admite como máximo 1 fotograma"
        )
        if len(frames) == 1:
            assert isinstance(band, dict)
            assert band["center_um"] > 0 and band["tolerance_um"] > 0
        else:
            assert band is None

    elif status == "no_coverage":
        assert reason == "no_observations"
        assert band is None
        assert frames == []


def test_casos_especificos_de_control_qa() -> None:
    """Comprueba que cada uno de los 5 archivos represente el escenario exacto de QA."""
    by_name = dict(_load_all_fixtures())

    qa01 = by_name["qa_01_dos_epocas_ready.json"]
    assert qa01["status"] == "ready"
    assert qa01["reason"] is None
    assert len(qa01["frames"]) == 2

    qa02 = by_name["qa_02_fecha_repetida_dedup.json"]
    assert qa02["status"] == "insufficient"
    assert qa02["reason"] == "single_epoch"
    assert len(qa02["frames"]) == 1

    qa03 = by_name["qa_03_una_epoca_insufficient.json"]
    assert qa03["status"] == "insufficient"
    assert qa03["reason"] == "single_epoch"
    assert len(qa03["frames"]) == 1

    qa04 = by_name["qa_04_incompatibilidad_espectral.json"]
    assert qa04["status"] == "insufficient"
    assert qa04["reason"] == "no_common_band"
    assert qa04["band"] is None
    assert qa04["frames"] == []

    qa05 = by_name["qa_05_sin_cobertura.json"]
    assert qa05["status"] == "no_coverage"
    assert qa05["reason"] == "no_observations"
    assert qa05["band"] is None
    assert qa05["frames"] == []
    assert math.isclose(qa05["query"]["ra_deg"], 133.795129, abs_tol=1e-4)
    assert math.isclose(qa05["query"]["dec_deg"], -7.245147, abs_tol=1e-4)


def test_consistencia_matriz_5_casos_markdown() -> None:
    """Verifica que `docs/qa/datos/matriz_5_casos.md` documente los 5 objetos del reto."""
    assert MATRIZ_MD_PATH.is_file(), f"No existe {MATRIZ_MD_PATH}"
    content = MATRIZ_MD_PATH.read_text(encoding="utf-8")

    expected_objects = [
        "Estrella de Barnard",
        "Epsilon Indi B",
        "WISE 0855",
        "RW Aurigae",
        "R Draconis",
    ]
    for obj in expected_objects:
        assert obj in content, f"Falta el objeto obligatorio '{obj}' en matriz_5_casos.md"

    assert "08h55m10.831s" in content
    assert "133.795129" in content
    assert "-7.245147" in content
    assert "spherex_dr1" in content
    assert "spherex_qr3" in content


def test_consistencia_evidencia_cruda_csv_y_wise0855() -> None:
    """Valida los 5 casos, rangos ICRS y conversión sexagesimal de WISE 0855 en el CSV crudo."""
    assert EVIDENCIA_CSV_PATH.is_file(), f"No existe {EVIDENCIA_CSV_PATH}"

    with EVIDENCIA_CSV_PATH.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    assert len(rows) > 0, "El archivo evidencia_cruda_irsa.csv está vacío"

    expected_cases = {
        "barnards_star": "Barnard's Star",
        "eps_ind_b": "Epsilon Indi B",
        "wise_0855": "WISE 0855",
        "rw_aur": "RW Aurigae",
        "r_dra": "R Draconis",
    }
    found_cases = {row["case_id"]: row["target_name"] for row in rows}
    assert set(expected_cases.keys()) == set(found_cases.keys())
    for cid, expected_target in expected_cases.items():
        assert found_cases[cid] == expected_target

    # Conversión oficial de WISE 0855: 08h55m10.831s, -07°14′42.53″
    expected_wise_ra = (8.0 + 55.0 / 60.0 + 10.831 / 3600.0) * 15.0
    expected_wise_dec = -(7.0 + 14.0 / 60.0 + 42.53 / 3600.0)

    wise_rows = [r for r in rows if r["case_id"] == "wise_0855"]
    assert len(wise_rows) > 0

    for row in rows:
        q_ra = float(row["query_ra_deg"])
        q_dec = float(row["query_dec_deg"])
        _assert_valid_icrs(q_ra, q_dec)

        if row["s_ra"].strip() != "" and row["s_dec"].strip() != "":
            _assert_valid_icrs(float(row["s_ra"]), float(row["s_dec"]))

    for w_row in wise_rows:
        q_ra = float(w_row["query_ra_deg"])
        q_dec = float(w_row["query_dec_deg"])
        assert math.isclose(q_ra, expected_wise_ra, abs_tol=1e-5)
        assert math.isclose(q_dec, expected_wise_dec, abs_tol=1e-5)

    wise_qr3 = [r for r in wise_rows if r["requested_collection"] == "spherex_qr3"]
    assert len(wise_qr3) == 1
    assert wise_qr3[0]["query_status"] == "no_observations"

    wise_dr1 = [r for r in wise_rows if r["requested_collection"] == "spherex_dr1"]
    assert len(wise_dr1) > 2
    assert all(r["query_status"] == "ok" for r in wise_dr1)
