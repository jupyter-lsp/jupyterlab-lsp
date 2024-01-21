""" run python unit tests with pytest
"""
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

OS = platform.system()
PY = "".join(map(str, sys.version_info[:2]))

SCRIPTS = Path(__file__).parent
ROOT = SCRIPTS.parent
BUILD = ROOT / "build"
REPORTS = BUILD / "reports" / f"{OS}_{PY}".lower()
CACHE = BUILD / ".cache/.pytest_cache"

OS_PY_ARGS = {
    # notebook and ipykernel releases do not yet support python 3.8 on windows
    # ("Windows", "38"): ["-k", "not serverextension"]
}

os.environ.update(
    JUPYTER_PLATFORM_DIRS="1",
)


def run_tests(*extra_args):
    """actually run the tests"""

    pytest_reports = REPORTS / "utest"

    if pytest_reports.exists():
        shutil.rmtree(pytest_reports)

    pytest_reports.mkdir(parents=True)

    args = [
        sys.executable,
        "-m",
        "pytest",
        "-vv",
        "--color=yes",
        "--tb=long",
        "--pyargs",
        "jupyter_lsp",
        "-o",
        f"cache_dir={CACHE}",
        "--cov=jupyter_lsp",
        "--cov-report=term-missing:skip-covered",
        "--cov-report=html:htmlcov",
        "--cov-context=test",
        "--cov-branch",
        "--html=pytest/index.html",
        "--self-contained-html",
        *OS_PY_ARGS.get((OS, PY), []),
        *extra_args,
    ]
    print(">>>", "  ".join(args))
    return subprocess.call(args, cwd=pytest_reports)


if __name__ == "__main__":
    sys.exit(run_tests(*sys.argv[1:]))
