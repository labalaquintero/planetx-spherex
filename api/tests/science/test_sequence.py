from io import BytesIO

from astropy import units as u
from astropy.coordinates import SkyCoord
from astropy.io import fits
from astropy.wcs import WCS
import numpy as np
from PIL import Image

from api.planetx.science import Cutout, build_sequence


_RA, _DEC = 10.25, -12.5
_FIELD = 0.1
_MAY = "2025-05-06T12:20:24.888"
_OCT = "2025-10-31T18:55:38.358"


def _cutout(
    folder, obs_id, date, *, wavelength=1.0, rotate=False, offset=0, bad_pixels=False,
    empty=False,
):
    size = 80
    wcs = WCS(naxis=2)
    wcs.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    wcs.wcs.radesys = "ICRS"
    wcs.wcs.crval = [_RA, _DEC]
    wcs.wcs.crpix = [(size + 1) / 2] * 2
    wcs.wcs.cdelt = [-_FIELD / 64, _FIELD / 64]
    if rotate:
        wcs.wcs.pc = [[0, -1], [1, 0]]

    y, x = np.indices((size, size))
    east, north = SkyCoord(_RA * u.deg, _DEC * u.deg).spherical_offsets_to(
        wcs.pixel_to_world(x, y)
    )
    east, north = east.deg, north.deg
    data = (2 + 40 * north + 11 * east + offset).astype(np.float32)
    flags = np.zeros(data.shape, dtype=np.int32)
    if bad_pixels:
        flags[(abs(east) < 0.004) & (abs(north) < 0.004)] = 1 << 6
        flags[(abs(east - 0.024) < 0.004) & (abs(north - 0.024) < 0.004)] = 1 << 21
        data[(abs(east + 0.026) < 0.004) & (abs(north + 0.026) < 0.004)] = np.nan
    if empty:
        flags.fill(1 << 9)

    header = wcs.to_header()
    header["OBSID"] = obs_id
    header["DATE-OBS"] = date
    header["TIMESYS"] = "UTC"
    header["BUNIT"] = "MJy/sr"
    header["WCSAXESW"] = 2
    for axis, index in [(1, "X"), (2, "Y")]:
        header[f"CTYPE{axis}W"] = "WAVE-TAB"
        header[f"CUNIT{axis}W"] = "um"
        header[f"CRPIX{axis}W"] = 1
        header[f"CRVAL{axis}W"] = 1
        header[f"CDELT{axis}W"] = 1
        header[f"PV{axis}_3W"] = axis
        header[f"PS{axis}_0W"] = "WCS-WAVE"
        header[f"PS{axis}_1W"] = "VALUES"
        header[f"PS{axis}_2W"] = index

    spectrum = np.full((1, 2, 2, 2), [wavelength, 0.025], dtype=np.float32)
    wave_table = fits.BinTableHDU.from_columns(
        [
            fits.Column(name="X", format="2J", array=[[1, size]]),
            fits.Column(name="Y", format="2J", array=[[1, size]]),
            fits.Column(name="VALUES", format="8E", dim="(2,2,2)", array=spectrum),
        ],
        name="WCS-WAVE",
    )
    path = folder / f"{obs_id}.fits"
    fits.HDUList([
        fits.PrimaryHDU(),
        fits.ImageHDU(data, header, name="IMAGE"),
        fits.ImageHDU(flags, name="FLAGS"),
        wave_table,
    ]).writeto(path)
    return Cutout(obs_id, "dr1", f"https://irsa.ipac.caltech.edu/{obs_id}", path)


def _sequence(*cutouts):
    return build_sequence(ra_deg=_RA, dec_deg=_DEC, fov_deg=_FIELD, cutouts=cutouts)


def test_pair_uses_one_sky_grid_mask_and_contrast(tmp_path):
    first = _cutout(tmp_path, "a", _MAY, bad_pixels=True)
    last = _cutout(tmp_path, "b", _OCT, rotate=True, offset=0.5)
    result, pngs = _sequence(last, first)

    assert result.status == "ready"
    assert result.reason is None
    assert [frame["observed_at"] for frame in result.frames] == [_MAY + "Z", _OCT + "Z"]
    assert [frame["source_url"] for frame in result.frames] == [first.source_url, last.source_url]
    images = []
    for frame in result.frames:
        with Image.open(BytesIO(pngs[frame["id"]])) as rendered:
            assert rendered.size == (64, 64)
            assert rendered.mode == "LA"
            images.append(np.array(rendered))
    early, late = images
    assert np.array_equal(early[..., 1], late[..., 1])
    assert early[32, 32, 1] == 0
    assert early[48, 48, 1] == 0
    assert early[16, 16, 1] == 255
    for frame in images:
        assert frame[16, 32, 0] > frame[48, 32, 0]  # North up.
        assert frame[25, 12, 0] > frame[25, 50, 0]  # East left.
    assert late[25, 32, 0] > early[25, 32, 0]  # Shared scale preserves the input offset.


def test_incompatible_bands_keep_one_frame(tmp_path):
    first = _cutout(tmp_path, "a", _MAY, wavelength=1.0)
    last = _cutout(tmp_path, "b", _OCT, wavelength=1.2)
    result, pngs = _sequence(first, last)

    assert result.status == "insufficient"
    assert result.reason == "no_common_band"
    assert len(result.frames) == len(pngs) == 1


def test_repeated_observation_or_timestamp_is_one_epoch(tmp_path):
    first = _cutout(tmp_path, "a", _MAY)
    same_time = _cutout(tmp_path, "b", _MAY, rotate=True)
    alternative = tmp_path / "other-release"
    alternative.mkdir()
    same_observation = _cutout(alternative, "a", _OCT, rotate=True)

    for duplicate in (same_time, same_observation):
        result, pngs = _sequence(first, duplicate)
        assert result.status == "insufficient"
        assert result.reason == "single_epoch"
        assert len(result.frames) == len(pngs) == 1


def test_unusable_pixels_produce_no_frame(tmp_path):
    result, pngs = _sequence(_cutout(tmp_path, "a", _MAY, empty=True))

    assert result.status == "insufficient"
    assert result.reason == "no_usable_frames"
    assert result.band is None
    assert result.frames == [] and pngs == {}
