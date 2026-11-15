import pytest

from irsa_helpers import make_fits
from planetx.irsa.errors import InvalidFits
from planetx.irsa.fits import list_extensions, extract_extensions

KEEP = ("IMAGE", "FLAGS", "VARIANCE", "ZODI", "WCS-WAVE")


def test_epsf_is_dropped_and_the_rest_is_kept_byte_for_byte():
    full = make_fits(epsf_bytes=2_000_000)  # SINTÉTICO
    assert list_extensions(full) == ["PRIMARY", "IMAGE", "FLAGS", "VARIANCE", "ZODI", "EPSF", "WCS-WAVE"]

    reduced = extract_extensions(full, KEEP)

    assert list_extensions(reduced) == ["PRIMARY", "IMAGE", "FLAGS", "VARIANCE", "ZODI", "WCS-WAVE"]
    assert len(reduced) % 2880 == 0
    assert len(reduced) < len(full) / 10  # el 97 % era EPSF
    assert full.startswith(reduced[:2880])  # los bloques se copian tal cual


@pytest.mark.parametrize(
    "data",
    [b"", b"x" * 25, b"<html>503</html>".ljust(5000, b" "), make_fits()[:5000], make_fits()[:-3000]],
)
def test_non_fits_or_truncated_is_rejected(data):
    with pytest.raises(InvalidFits):
        extract_extensions(data, KEEP)


def test_missing_image_extension_is_rejected():
    renamed = make_fits().replace(b"'IMAGE   '", b"'OTHER   '")  # ninguna extensión llamada IMAGE
    with pytest.raises(InvalidFits):
        extract_extensions(renamed, KEEP)
