import pathlib
import platform

import pytest

from ..paths import normalized_uri

WIN = platform.system == "Windows"
HOME = pathlib.Path("~").expanduser()


@pytest.mark.skipif(WIN, reason="can't test POSIX paths on Windows")
@pytest.mark.parametrize(
    "root_dir, expected_root_uri",
    [
        # probably need to try some other things
        [str(HOME / "foo"), (HOME / "foo").as_uri()]
    ],
)
def test_normalize_paths(root_dir, expected_root_uri):  # pragma: no cover
    """ paths we can easily test on POSIX platforms
    """
    assert normalized_uri(root_dir) == expected_root_uri


@pytest.mark.skipif(not WIN, reason="can't test Windows paths on POSIX")
@pytest.mark.parametrize(
    "root_dir, expected_root_uri",
    [
        ["c:\\Users\\user1", "file:///c:/Users/user1"],
        ["C:\\Users\\user1", "file:///c:/Users/user1"],
        ["//VBOXSVR/shared-folder", "file://vboxsvr/shared-folder"],
    ],
)
def test_normalize_windows_path_case(root_dir, expected_root_uri):  # pragma: no cover
    """ paths we can easily test on non-windows platforms
    """
    assert normalized_uri(root_dir) == expected_root_uri
