"""Build a prepared comparison bundle with a difference image from two local FITS."""

from argparse import ArgumentParser
from dataclasses import asdict, replace
from io import BytesIO
import json
from math import isclose
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image

from ..catalog import CatalogError, get_prepared
from .sequence import Cutout, Difference, _difference_id, build_sequence


def _verified_png(path: Path, regenerated: bytes) -> bytes:
    original = path.read_bytes()
    # Compression can differ across hosts while the data and mask are identical.
    with Image.open(BytesIO(original)) as before, Image.open(BytesIO(regenerated)) as after:
        if (before.mode, before.size, before.tobytes()) != (after.mode, after.size, after.tobytes()):
            raise ValueError(f"Los FITS reprocesados no reproducen los píxeles de {path.name}.")
    return original


def prepare_difference(
    manifest_path: Path, fits_paths: tuple[Path, Path], output: Path
) -> Difference:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    entries = manifest["entries"]
    if len(entries) != 1:
        raise ValueError("El manifiesto de entrada debe contener un solo caso preparado.")
    entry = entries[0]
    query = entry["query"]
    original_products = manifest_path.parent / "products"
    comparison = get_prepared(
        ra_deg=query["ra_deg"],
        dec_deg=query["dec_deg"],
        fov_deg=query["fov_deg"],
        science_version=entry["science_version"],
        manifest_path=manifest_path,
        products_dir=original_products,
    )
    if comparison is None or comparison["status"] != "ready" or len(comparison["frames"]) != 2:
        raise ValueError("Se requiere un caso preparado con dos épocas comparables.")
    frames = comparison["frames"]

    result, pngs = build_sequence(
        ra_deg=query["ra_deg"],
        dec_deg=query["dec_deg"],
        fov_deg=query["fov_deg"],
        cutouts=[
            Cutout(frame["observation_id"], frame["release"], frame["source_url"], path)
            for frame, path in zip(frames, fits_paths, strict=True)
        ],
        include_difference=True,
    )
    difference = result.difference
    if (
        difference is None
        or result.band is None
        or result.science_version != comparison["science_version"]
        or [frame["observed_at"] for frame in result.frames] != [frame["observed_at"] for frame in frames]
        or not all(isclose(value, comparison["band"][key]) for key, value in result.band.items())
    ):
        raise ValueError("Los FITS reprocesados no coinciden con las épocas o la banda del manifiesto.")

    verified_pngs = {
        original["id"]: _verified_png(original_products / f"{original['id']}.png", pngs[regenerated["id"]])
        for original, regenerated in zip(frames, result.frames, strict=True)
    }
    delta_png = pngs[difference.id]
    frame_ids = (frames[0]["id"], frames[1]["id"])
    difference = replace(difference, id=_difference_id(frame_ids, delta_png), frame_ids=frame_ids)
    verified_pngs[difference.id] = delta_png

    entry.update(comparison, difference=asdict(difference))
    products = output / "products"
    products.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(dir=output) as directory:
        staging = Path(directory)
        pending_manifest = staging / "manifest.json"
        pending_manifest.write_text(
            json.dumps(manifest, indent=2, allow_nan=False) + "\n", encoding="utf-8"
        )
        for product_id, png in verified_pngs.items():
            pending_png = staging / f"{product_id}.png"
            pending_png.write_bytes(png)
            pending_png.replace(products / pending_png.name)
        pending_manifest.replace(output / pending_manifest.name)
    return difference


def main() -> None:
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--fits-a", type=Path, required=True)
    parser.add_argument("--fits-b", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        product = prepare_difference(args.manifest, (args.fits_a, args.fits_b), args.output)
    except (CatalogError, ValueError, KeyError, OSError) as exc:
        parser.error(str(exc))
    print(f"Producto {product.id}: {product.common_valid_fraction:.2%} de píxeles comunes.")


if __name__ == "__main__":
    main()
