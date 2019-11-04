import pytest

from ..paths import normalize_uri


@pytest.mark.parametrize(
    "root_uri, normalized",
    [
        ["file:///c:/Users/user1", "file:///c:/Users/user1"],
        ["file:///C:/Users/user1", "file:///c:/Users/user1"],
    ],
)
def test_normalize_path(root_uri, normalized):
    assert normalize_uri(root_uri) == normalized
