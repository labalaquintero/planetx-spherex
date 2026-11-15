from collections.abc import Iterable
from dataclasses import dataclass
from hashlib import sha256
from io import BytesIO
from itertools import combinations
import json
from pathlib import Path
from typing import Literal, TypedDict

from astropy import units as u
from astropy.coordinates import SkyCoord
from astropy.io import fits
from astropy.time import Time
from astropy.wcs import WCS
import numpy as np
from PIL import Image
from reproject import reproject_interp


_SCIENCE_VERSION = "v1"
_FIELD_DEG = 0.1
_SHAPE = (64, 64)
_MIN_FRAME_COVERAGE = 0.75
_SOURCE_FLAG = 1 << 21

Release = Literal["dr1", "qr3"]
InsufficientReason = Literal["single_epoch", "no_common_band", "no_usable_frames"]


@dataclass(frozen=True)
class Cutout:
    """A local SPHEREx spectral image MEF and its archive provenance."""

    observation_id: str
    release: Release
    source_url: str
    local_path: Path


class Band(TypedDict):
    center_um: float
    tolerance_um: float


class Frame(TypedDict):
    id: str
    observation_id: str
    observed_at: str
    release: Release
    source_url: str
    quality_flags: list[str]


@dataclass(frozen=True)
class ScienceResult:
    status: Literal["ready", "insufficient"]
    reason: InsufficientReason | None
    band: Band | None
    frames: list[Frame]
    common_valid_fraction: float
    contrast_mjy_sr: tuple[float, float] | None
    science_version: str = _SCIENCE_VERSION


@dataclass(frozen=True)
class _Projected:
    cutout: Cutout
    date: Time
    observed_at: str
    image: np.ndarray
    wavelength_um: np.ndarray
    bandwidth_um: np.ndarray
    valid: np.ndarray


def build_sequence(
    *,
    ra_deg: float,
    dec_deg: float,
    fov_deg: float,
    cutouts: Iterable[Cutout],
) -> tuple[ScienceResult, dict[str, bytes]]:
    """Compare two epochs from local MEFs and return metadata and PNG bytes.

    F01 uses a 0.1 degree field. The caller supplies archive provenance and
    handles HTTP, storage and search outcomes. Unreadable or incompatible
    files raise errors so a transport failure cannot look like sky coverage.
    """
    if not (0 <= ra_deg < 360 and -90 <= dec_deg <= 90) or fov_deg != _FIELD_DEG:
        raise ValueError("Expected finite ICRS coordinates and a 0.1 degree field")

    grid = _comparison_grid(ra_deg, dec_deg, fov_deg)
    y, x = np.indices(_SHAPE)
    sky = grid.pixel_to_world(x, y)
    candidates = []
    for cutout in cutouts:
        projected = _project_cutout(cutout, grid, sky)
        if projected is not None:
            candidates.append(projected)

    if not candidates:
        return ScienceResult("insufficient", "no_usable_frames", None, [], 0.0, None), {}

    candidates.sort(key=lambda frame: (
        frame.date.jd1, frame.date.jd2, frame.cutout.observation_id, frame.cutout.source_url
    ))
    selected, reason = _select_frames(candidates)
    valid = np.logical_and.reduce([frame.valid for frame in selected])
    band, _ = _measure_band(selected, valid)
    samples = np.concatenate([frame.image[valid] for frame in selected])
    low, high = map(float, np.percentile(samples, [1, 99]))
    contrast = (low, high)
    coverage = float(valid.mean())

    frames = []
    pngs = {}
    for frame in selected:
        cutout = frame.cutout
        png = _render_png(frame.image, valid, contrast)
        identity = json.dumps([
            _SCIENCE_VERSION, ra_deg, dec_deg, fov_deg,
            cutout.observation_id, cutout.release, cutout.source_url,
        ]).encode("utf-8")
        frame_id = sha256(identity + png).hexdigest()
        frames.append(Frame(
            id=frame_id,
            observation_id=cutout.observation_id,
            observed_at=frame.observed_at,
            release=cutout.release,
            source_url=cutout.source_url,
            quality_flags=["masked_pixels"] if coverage < 1 else [],
        ))
        pngs[frame_id] = png

    status = "ready" if reason is None else "insufficient"
    return ScienceResult(status, reason, band, frames, coverage, contrast), pngs


def _comparison_grid(ra_deg: float, dec_deg: float, fov_deg: float) -> WCS:
    height, width = _SHAPE
    grid = WCS(naxis=2)
    grid.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    grid.wcs.cunit = ["deg", "deg"]
    grid.wcs.radesys = "ICRS"
    grid.wcs.crval = [ra_deg, dec_deg]
    grid.wcs.crpix = [(width + 1) / 2, (height + 1) / 2]
    grid.wcs.cdelt = [-fov_deg / width, fov_deg / height]
    return grid


def _project_cutout(cutout: Cutout, grid: WCS, sky: SkyCoord) -> _Projected | None:
    if cutout.release not in ("dr1", "qr3") or not cutout.source_url.strip():
        raise ValueError("Expected provenance for a DR1 or QR3 cutout")

    with fits.open(Path(cutout.local_path), memmap=False) as hdus:
        image = hdus["IMAGE"]
        flags = hdus["FLAGS"].data
        if not cutout.observation_id or image.header["OBSID"] != cutout.observation_id:
            raise ValueError("Cutout OBSID does not match its archive provenance")
        if image.header["TIMESYS"].strip().upper() != "UTC":
            raise ValueError("Expected SPHEREx observation times in UTC")
        date = Time(image.header["DATE-OBS"], format="isot", scale="utc", precision=9)
        observed_at = date.isot.rstrip("0").rstrip(".") + "Z"

        data = image.data
        if (
            data is None or flags is None or data.ndim != 2
            or data.shape != flags.shape or flags.dtype.kind not in "iu"
        ):
            raise ValueError("Expected a 2D IMAGE and an integer FLAGS mask of the same shape")
        scale = u.Unit(image.header["BUNIT"]).to(u.MJy / u.sr)
        values = np.asarray(data, dtype=np.float64) * scale
        # The SOURCE bit marks a known astronomical source, not a defect.
        valid = np.isfinite(values) & ((flags == 0) | (flags == _SOURCE_FLAG))
        spatial_wcs = WCS(image.header).celestial
        projected = reproject_interp(
            (np.where(valid, values, np.nan), spatial_wcs),
            grid,
            shape_out=_SHAPE,
            order="bilinear",
            return_footprint=False,
        )

        # The spectral table is indexed by detector pixel, without celestial SIP.
        spectral_header = image.header.copy()
        for key in ("A_ORDER", "B_ORDER", "AP_ORDER", "BP_ORDER"):
            spectral_header.remove(key, ignore_missing=True)
        spectral_wcs = WCS(spectral_header, key="W", fobj=hdus)
        x, y = spatial_wcs.world_to_pixel(sky)
        wavelength, bandwidth = spectral_wcs.pixel_to_world(x, y)
        wavelength_um = wavelength.to_value(u.um)
        bandwidth_um = bandwidth.to_value(u.um)

    valid = (
        np.isfinite(projected)
        & np.isfinite(wavelength_um)
        & np.isfinite(bandwidth_um)
        & (wavelength_um > 0)
        & (bandwidth_um > 0)
    )
    if valid.mean() < _MIN_FRAME_COVERAGE:
        return None
    return _Projected(cutout, date, observed_at, projected, wavelength_um, bandwidth_um, valid)


def _measure_band(frames: tuple[_Projected, ...], valid: np.ndarray) -> tuple[Band, float]:
    low = min(float(frame.wavelength_um[valid].min()) for frame in frames)
    high = max(float(frame.wavelength_um[valid].max()) for frame in frames)
    width = min(float(frame.bandwidth_um[valid].min()) for frame in frames)
    # The overlap remaining if each local passband has the narrowest measured width.
    return Band(center_um=(low + high) / 2, tolerance_um=width / 2), width - (high - low)


def _select_frames(
    candidates: list[_Projected],
) -> tuple[tuple[_Projected, ...], InsufficientReason | None]:
    best_pair = None
    best_score = None
    distinct_epochs = False
    for first, last in combinations(candidates, 2):
        same_observation = first.cutout.observation_id == last.cutout.observation_id
        if same_observation or first.observed_at == last.observed_at:
            continue
        distinct_epochs = True
        valid = first.valid & last.valid
        # Each frame covers at least 75%, so at least half the field is shared.
        _, overlap = _measure_band((first, last), valid)
        if overlap <= 0:
            continue
        score = ((last.date - first.date).sec, int(valid.sum()), overlap)
        if best_score is None or score > best_score:
            best_pair, best_score = (first, last), score

    if best_pair is not None:
        return best_pair, None
    single = max(candidates, key=lambda frame: int(frame.valid.sum()))
    return (single,), "no_common_band" if distinct_epochs else "single_epoch"


def _render_png(
    image: np.ndarray, valid: np.ndarray, contrast: tuple[float, float]
) -> bytes:
    low, high = contrast
    pixels = np.zeros((*_SHAPE, 2), dtype=np.uint8)
    if low == high:
        pixels[valid, 0] = 127
    else:
        intensity = np.clip((image[valid] - low) / (high - low), 0, 1)
        pixels[valid, 0] = np.rint(intensity * 255).astype(np.uint8)
    pixels[valid, 1] = 255
    # FITS rows increase to the north. PNG rows run from top to bottom.
    out = BytesIO()
    Image.fromarray(np.flipud(pixels)).save(out, format="PNG")
    return out.getvalue()
