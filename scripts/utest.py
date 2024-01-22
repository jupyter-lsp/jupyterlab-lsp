""" run python unit tests with pytest
"""
import json
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

OS = platform.system()
PY = "".join(map(str, sys.version_info[:2]))

SCRIPTS = Path(__file__).parent
ROOT = SCRIPTS.parent.resolve()
SETUP_CFG = ROOT / "setup.cfg"
BUILD = ROOT / "build"
REPORTS = BUILD / "reports" / f"{OS}_{PY}".lower()
CACHE = BUILD / ".cache/.pytest_cache"
OUT = REPORTS / "utest"

OS_PY_ARGS = {
    # notebook and ipykernel releases do not yet support python 3.8 on windows
    # ("Windows", "38"): ["-k", "not serverextension"]
}

os.environ.update(
    JUPYTER_PLATFORM_DIRS="1",
    # pass down the root so ``node_modules`` can be found
    JLSP_TEST_ROOT=str(ROOT),
    # pass down coverage args
    JLSP_TEST_SUBPROCESS_PREFIX=json.dumps(
        [
            sys.executable,
            "-m",
            "coverage",
            "run",
            "--source=jupyter_lsp",
            "--rcfile",
            str(SETUP_CFG),
            "--data-file",
            str(OUT / ".coverage.subprocess"),
            "-m",
        ]
    ),
)


def run_tests(*extra_args):
    """actually run the tests"""

    if OUT.exists():
        shutil.rmtree(OUT)

    OUT.mkdir(parents=True)

    args = [
        sys.executable,
        "-m",
        "pytest",
        # what
        "--pyargs",
        "jupyter_lsp",
        # common
        "-vv",
        "--color=yes",
        "--tb=long",
        "-o",
        f"cache_dir={CACHE}",
        # parallel
        "-n=auto",
        # cov
        "--cov=jupyter_lsp",
        "--cov-config",
        str(SETUP_CFG),
        "--cov-report=term-missing:skip-covered",
        "--cov-report=html:htmlcov",
        "--cov-context=test",
        "--no-cov-on-fail",
        # html
        "--html=pytest/index.html",
        "--self-contained-html",
        *OS_PY_ARGS.get((OS, PY), []),
        *extra_args,
    ]
    print(">>>", "  ".join(args))
    return subprocess.call(args, cwd=OUT)


if __name__ == "__main__":
    sys.exit(run_tests(*sys.argv[1:]))
