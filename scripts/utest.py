""" run python unit tests with pytest
"""
import sys

import pytest


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
    ] + list(sys.argv[1:])

    return pytest.main(args)


if __name__ == "__main__":
    sys.exit(run_tests())
