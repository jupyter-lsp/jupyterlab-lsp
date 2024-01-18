""" run python unit tests with pytest
"""
import os
import platform
import subprocess
import sys
from pathlib import Path

OS = platform.system()
PY = "".join(map(str, sys.version_info[:2]))

SCRIPTS = Path(__file__).parent
ROOT = SCRIPTS.parent
JLSP = ROOT / "python_packages/jupyter_lsp"

OS_PY_ARGS = {
    # notebook and ipykernel releases do not yet support python 3.8 on windows
    # ("Windows", "38"): ["-k", "not serverextension"]
}

os.environ.update(
    JUPYTER_PLATFORM_DIRS="1",
)


def run_tests():
    """actually run the tests"""
    args = [
        sys.executable,
        "-m",
        "pytest",
        *OS_PY_ARGS.get((OS, PY), []),
        *sys.argv[1:],
    ]
    print(">>>", "  ".join(args))
    return subprocess.call(args, cwd=str(JLSP))


if __name__ == "__main__":
    sys.exit(run_tests())
