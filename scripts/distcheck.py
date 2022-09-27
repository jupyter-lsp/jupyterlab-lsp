"""sanity checks for webpack vs python packaging"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent

# known packages that cause problems if vendored in webpack
BAD_CHUNK_PATTERNS = {
    (
        "codemirror_codemirror",
        "codemirror_lib",
    ): """Please ensure CodeMirror is imported by type _only_, e.g.

        import type * as CodeMirror from 'codemirror';

    see https://github.com/jupyter-lsp/jupyterlab-lsp/issues/575
    """
}

# canary file created by a debug build
BUILD_LOG = "build_log.json"

# where the packages are
PY_PACKAGES = ROOT / "python_packages"

# just one, for now
LABEXTENSION_PATHS = [
    "jupyterlab_lsp/jupyterlab_lsp/labextensions/@jupyter-lsp/jupyterlab-lsp"
]


def check_webpack():
    """verify certain packages would not be bundled

    this it to avoid distributing private copies of modules
    """
    for path in LABEXTENSION_PATHS:
        build_log = PY_PACKAGES / path / BUILD_LOG
        print("checking for", build_log)
        if not build_log.exists():
            print(build_log, "missing, doing verbose debug build")
            subprocess.check_call(["jlpm", "lerna", "run", "build:labextension:dev"])
            break

    bad = []
    good = 0

    for path in LABEXTENSION_PATHS:
        for asset in (PY_PACKAGES / path / "static").rglob("*.js"):
            for patterns, msg in BAD_CHUNK_PATTERNS.items():
                for pattern in patterns:
                    if pattern in str(asset):
                        print(">>> Found", pattern, "in", asset, "\n", msg)
                        bad += [asset]
            if asset not in bad:
                good += 1

    if not good:
        print("didn't find any js assets, probably broken")
        return 1

    print(f"{good} assets looked good vs", sum(BAD_CHUNK_PATTERNS.keys(), tuple()))

    if bad:
        print(f"{bad} assets appear to be on the bad list", BAD_CHUNK_PATTERNS)

    return len(bad)


if __name__ == "__main__":
    sys.exit(check_webpack())
