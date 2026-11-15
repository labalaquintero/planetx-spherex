"""Create a prepared catalog from local SPHEREx cutouts."""

from argparse import ArgumentParser
from dataclasses import asdict
from datetime import UTC, datetime
import json
from pathlib import Path
from shutil import copyfile
from tempfile import TemporaryDirectory

from ..catalog import CatalogError, get_prepared
from .sequence import Cutout, ScienceResult, build_sequence


def prepare_case(
    *,
    ra_deg: float,
    dec_deg: float,
    cutouts: list[Cutout],
    output: Path,
    base: Path | None = None,
) -> ScienceResult:
    fov_deg = 0.1
    result, pngs = build_sequence(
        ra_deg=ra_deg, dec_deg=dec_deg, fov_deg=fov_deg, cutouts=cutouts,
        include_difference=True,
    )
    if result.status != "ready" or result.difference is None:
        raise ValueError(f"Los recortes no producen un par comparable ({result.reason}).")

    if output.exists():
        raise FileExistsError(f"Elige una carpeta de salida nueva. Ya existe {output}.")
    manifest = (
        json.loads((base / "manifest.json").read_text(encoding="utf-8"))
        if base is not None else {"manifest_version": "1", "entries": []}
    )
    if not isinstance(manifest, dict) or not isinstance(manifest.get("entries"), list):
        raise ValueError("El catálogo base no tiene una lista de entradas.")
    manifest["entries"].append({
        "schema_version": "1",
        "status": "ready",
        "reason": None,
        "mode": "prepared",
        "query": {"ra_deg": ra_deg, "dec_deg": dec_deg, "frame": "ICRS", "fov_deg": fov_deg},
        "band": result.band,
        "checked_at": datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "science_version": result.science_version,
        "warnings": [],
        "frames": [{**frame, "image_url": f"/api/v1/images/{frame['id']}"} for frame in result.frames],
        "difference": asdict(result.difference),
    })

    output.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(dir=output.parent) as area:
        staging = Path(area) / "catalog"
        products = staging / "products"
        products.mkdir(parents=True)
        if base is not None:
            for source in (base / "products").glob("*.png"):
                copyfile(source, products / source.name)
        for product_id, png in pngs.items():
            destination = products / f"{product_id}.png"
            if destination.exists() and destination.read_bytes() != png:
                raise ValueError(f"El producto {product_id} ya existe con un contenido diferente.")
            destination.write_bytes(png)

        manifest_path = staging / "manifest.json"
        manifest_path.write_text(json.dumps(manifest, indent=2, allow_nan=False) + "\n", encoding="utf-8")
        for entry in manifest["entries"]:
            query = entry["query"]
            prepared = get_prepared(
                ra_deg=query["ra_deg"], dec_deg=query["dec_deg"], fov_deg=query["fov_deg"],
                science_version=entry["science_version"], manifest_path=manifest_path, products_dir=products,
            )
            if prepared and entry.get("difference") and "difference" not in prepared:
                raise ValueError("Falta el mapa de diferencias de un caso del catálogo.")
        staging.rename(output)
    return result


def main() -> None:
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--ra-deg", type=float, required=True)
    parser.add_argument("--dec-deg", type=float, required=True)
    parser.add_argument("--cutout", nargs=4, action="append", required=True, metavar="VALOR",
                        help="Identificador OBSID/Dn, colección (dr1 o qr3), URL original y FITS local. Repetible.")
    parser.add_argument("--base", type=Path, help="Carpeta del catálogo previo, con manifest.json y products/.")
    parser.add_argument("--output", type=Path, required=True, help="Carpeta nueva para el catálogo generado.")
    args = parser.parse_args()
    try:
        result = prepare_case(
            ra_deg=args.ra_deg, dec_deg=args.dec_deg,
            cutouts=[Cutout(obs_id, release, url, Path(path)) for obs_id, release, url, path in args.cutout],
            output=args.output, base=args.base,
        )
    except (CatalogError, KeyError, OSError, ValueError) as exc:
        parser.error(str(exc))
    print(f"{args.output} · {result.common_valid_fraction:.2%} de píxeles válidos en ambas épocas.")


if __name__ == "__main__":
    main()
