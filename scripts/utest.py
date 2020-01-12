""" run python unit tests with pytest
"""
import platform
import sys

import pytest

OS = platform.system()
PY = "".join(map(str, sys.version_info[:2]))

OS_PY_ARGS = {
    # notebook and ipykernel releases do not yet support python 3.8 on windows
    ("Windows", "38"): ["-k", "not serverextension"]
}


def run_tests():
    """ actually run the tests
    """
    args = [
        "--pyargs",
        "jupyter_lsp",
        "--cov",
        "jupyter_lsp",
        "--cov-report",
        "term-missing:skip-covered",
        "-p",
        "no:warnings",
        "--flake8",
        "--cov-fail-under=100",
        "-vv",
        *OS_PY_ARGS.get((OS, PY), []),
    ] + list(sys.argv[1:])

    return pytest.main(args)


if __name__ == "__main__":
    sys.exit(run_tests())
