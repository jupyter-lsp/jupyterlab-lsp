import sys

import pytest

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

if __name__ == "__main__":
    sys.exit(pytest.main(args))
