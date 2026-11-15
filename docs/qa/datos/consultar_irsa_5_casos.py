import csv
import math
import sys
from datetime import datetime, timezone
import astropy.coordinates as coord
import astropy.units as u
from astropy.time import Time
import pyvo

SIA2_URL = "https://irsa.ipac.caltech.edu/SIA"
COLLECTIONS = ["spherex_dr1", "spherex_qr3"]
FIELD_SIZE_DEG = 0.10
RADIUS_DEG = round(math.hypot(FIELD_SIZE_DEG / 2.0, FIELD_SIZE_DEG / 2.0), 4)  # ~0.0707 -> 0.071°


def resolve_targets():
    targets = []

    # a) Barnard's Star
    c_barnard = coord.SkyCoord.from_name("Barnard's Star", frame="icrs")
    targets.append({
        "case_id": "barnards_star",
        "name": "Barnard's Star",
        "query_name": "Barnard's Star",
        "ra_deg": float(c_barnard.ra.deg),
        "dec_deg": float(c_barnard.dec.deg),
        "source": "CDS Sesame / SIMBAD (via astropy SkyCoord.from_name('Barnard\\'s Star'))",
    })

    # b) Epsilon Indi B (eps Ind B)
    c_eps_ind_b = coord.SkyCoord.from_name("eps Ind B", frame="icrs")
    targets.append({
        "case_id": "eps_ind_b",
        "name": "Epsilon Indi B",
        "query_name": "eps Ind B",
        "ra_deg": float(c_eps_ind_b.ra.deg),
        "dec_deg": float(c_eps_ind_b.dec.deg),
        "source": "CDS Sesame / SIMBAD (via astropy SkyCoord.from_name('eps Ind B'))",
    })

    # c) WISE 0855 (posición oficial exacta: 08h55m10.831s, -07d14m42.53s)
    c_wise = coord.SkyCoord("08h55m10.831s", "-07d14m42.53s", frame="icrs")
    targets.append({
        "case_id": "wise_0855",
        "name": "WISE 0855",
        "query_name": "08h55m10.831s, -07d14m42.53s",
        "ra_deg": float(c_wise.ra.deg),
        "dec_deg": float(c_wise.dec.deg),
        "source": "Posición oficial fija del reto ICRS (08h55m10.831s, -07d14m42.53s)",
    })

    # d) RW Aurigae (RW Aur)
    c_rw_aur = coord.SkyCoord.from_name("RW Aur", frame="icrs")
    targets.append({
        "case_id": "rw_aur",
        "name": "RW Aurigae",
        "query_name": "RW Aur",
        "ra_deg": float(c_rw_aur.ra.deg),
        "dec_deg": float(c_rw_aur.dec.deg),
        "source": "CDS Sesame / SIMBAD (via astropy SkyCoord.from_name('RW Aur'))",
    })

    # e) R Draconis (R Dra)
    c_r_dra = coord.SkyCoord.from_name("R Dra", frame="icrs")
    targets.append({
        "case_id": "r_dra",
        "name": "R Draconis",
        "query_name": "R Dra",
        "ra_deg": float(c_r_dra.ra.deg),
        "dec_deg": float(c_r_dra.dec.deg),
        "source": "CDS Sesame / SIMBAD (via astropy SkyCoord.from_name('R Dra'))",
    })

    return targets


def mjd_to_utc_iso(mjd_val):
    if mjd_val is None or mjd_val == "" or (isinstance(mjd_val, float) and math.isnan(mjd_val)):
        return ""
    try:
        t = Time(float(mjd_val), format="mjd", scale="utc")
        return t.isot
    except Exception:
        return str(mjd_val)


def m_to_um(val):
    if val is None or val == "" or (isinstance(val, float) and math.isnan(val)):
        return ""
    try:
        return f"{float(val) * 1e6:.4f}"
    except Exception:
        return str(val)


def safe_val(row, col):
    if col not in row.colnames:
        return ""
    v = row[col]
    if hasattr(v, "mask") and v.mask:
        return ""
    if isinstance(v, bytes):
        return v.decode("utf-8", errors="replace")
    return v


def main():
    print("=== Resolviendo coordenadas ICRS ===")
    targets = resolve_targets()
    for t in targets:
        print(f"{t['name']} ({t['query_name']}): RA={t['ra_deg']:.6f} deg, Dec={t['dec_deg']:.6f} deg | Fuente: {t['source']}")

    print(f"\n=== Consultando SIA2 ({SIA2_URL}) con radio 0.071 deg (campo 0.10x0.10 deg) ===")
    service = pyvo.dal.SIA2Service(SIA2_URL)

    rows_out = []
    fieldnames = [
        "case_id",
        "target_name",
        "query_ra_deg",
        "query_dec_deg",
        "coord_source",
        "requested_collection",
        "obs_collection",
        "obs_id",
        "obs_publisher_did",
        "dataproduct_type",
        "calib_level",
        "s_ra",
        "s_dec",
        "t_min",
        "t_max",
        "t_min_utc",
        "em_min",
        "em_max",
        "em_min_um",
        "em_max_um",
        "energy_bandpassname",
        "access_format",
        "access_url",
        "query_status",
        "error_message",
    ]

    for t in targets:
        for col in COLLECTIONS:
            try:
                res = service.search(
                    pos=(t["ra_deg"], t["dec_deg"], 0.071),
                    collection=col,
                )
                table = res.to_table()
                print(f"[{t['name']}] collection={col} -> {len(table)} filas")
                if len(table) == 0:
                    rows_out.append({
                        "case_id": t["case_id"],
                        "target_name": t["name"],
                        "query_ra_deg": f"{t['ra_deg']:.6f}",
                        "query_dec_deg": f"{t['dec_deg']:.6f}",
                        "coord_source": t["source"],
                        "requested_collection": col,
                        "obs_collection": "",
                        "obs_id": "",
                        "obs_publisher_did": "",
                        "dataproduct_type": "",
                        "calib_level": "",
                        "s_ra": "",
                        "s_dec": "",
                        "t_min": "",
                        "t_max": "",
                        "t_min_utc": "",
                        "em_min": "",
                        "em_max": "",
                        "em_min_um": "",
                        "em_max_um": "",
                        "energy_bandpassname": "",
                        "access_format": "",
                        "access_url": "",
                        "query_status": "no_observations",
                        "error_message": "",
                    })
                else:
                    for r in table:
                        t_min_val = safe_val(r, "t_min")
                        em_min_val = safe_val(r, "em_min")
                        em_max_val = safe_val(r, "em_max")
                        rows_out.append({
                            "case_id": t["case_id"],
                            "target_name": t["name"],
                            "query_ra_deg": f"{t['ra_deg']:.6f}",
                            "query_dec_deg": f"{t['dec_deg']:.6f}",
                            "coord_source": t["source"],
                            "requested_collection": col,
                            "obs_collection": safe_val(r, "obs_collection"),
                            "obs_id": safe_val(r, "obs_id"),
                            "obs_publisher_did": safe_val(r, "obs_publisher_did"),
                            "dataproduct_type": safe_val(r, "dataproduct_type"),
                            "calib_level": safe_val(r, "calib_level"),
                            "s_ra": safe_val(r, "s_ra"),
                            "s_dec": safe_val(r, "s_dec"),
                            "t_min": t_min_val,
                            "t_max": safe_val(r, "t_max"),
                            "t_min_utc": mjd_to_utc_iso(t_min_val),
                            "em_min": em_min_val,
                            "em_max": em_max_val,
                            "em_min_um": m_to_um(em_min_val),
                            "em_max_um": m_to_um(em_max_val),
                            "energy_bandpassname": safe_val(r, "energy_bandpassname"),
                            "access_format": safe_val(r, "access_format"),
                            "access_url": safe_val(r, "access_url"),
                            "query_status": "ok",
                            "error_message": "",
                        })
            except Exception as exc:
                print(f"[{t['name']}] collection={col} -> ERROR: {exc}", file=sys.stderr)
                rows_out.append({
                    "case_id": t["case_id"],
                    "target_name": t["name"],
                    "query_ra_deg": f"{t['ra_deg']:.6f}",
                    "query_dec_deg": f"{t['dec_deg']:.6f}",
                    "coord_source": t["source"],
                    "requested_collection": col,
                    "obs_collection": "",
                    "obs_id": "",
                    "obs_publisher_did": "",
                    "dataproduct_type": "",
                    "calib_level": "",
                    "s_ra": "",
                    "s_dec": "",
                    "t_min": "",
                    "t_max": "",
                    "t_min_utc": "",
                    "em_min": "",
                    "em_max": "",
                    "em_min_um": "",
                    "em_max_um": "",
                    "energy_bandpassname": "",
                    "access_format": "",
                    "access_url": "",
                    "query_status": "service_error",
                    "error_message": str(exc),
                })

    out_csv = "docs/qa/datos/evidencia_cruda_irsa.csv"
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows_out)

    print(f"\nArchivo guardado exitosamente en: {out_csv} ({len(rows_out)} registros)")


if __name__ == "__main__":
    main()
