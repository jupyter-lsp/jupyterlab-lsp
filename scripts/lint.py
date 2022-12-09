""" code quality countermeasures
"""
# flake8: noqa: W503
import sys
from pathlib import Path
from subprocess import call

OK = 0
FAIL = 1

ROOT = Path(__file__).parent.parent
PYTHON_PACKAGES_PATH = ROOT / "python_packages"

PY_SRC_PACKAGES = {
    package_path: [
        path
        for path in package_path.rglob("*.py")
        if ".ipynb_checkpoints" not in str(path)
        and "/build/" not in str(path.as_posix())
    ]
    for package_path in PYTHON_PACKAGES_PATH.glob("*")
}

PY_SRC = [path for paths in PY_SRC_PACKAGES.values() for path in paths]
PY_SCRIPTS = list((ROOT / "scripts").rglob("*.py"))
PY_DOCS = list((ROOT / "docs").rglob("*.py"))
PY_ATEST = list((ROOT / "atest").glob("*.py"))

ALL_PY = [*PY_SRC, *PY_SCRIPTS, *PY_ATEST, *PY_DOCS]

ALL_ROBOT = list((ROOT / "atest").rglob("*.robot"))

ROBOCOP_EXCLUDE = [
    "can-be-resource-file",
    "file-too-long",
    "if-can-be-merged",
    "line-too-long",
    "missing-doc-keyword",
    "missing-doc-suite",
    "missing-doc-test-case",
    "too-long-test-case",
    "too-many-arguments",
    "too-many-calls-in-keyword",
    "too-many-calls-in-test-case",
    "wrong-case-in-keyword-name",
]

ROBOCOP_ARGS = [f"--exclude={rule}" for rule in ROBOCOP_EXCLUDE]


def lint():
    """get that linty fresh feeling"""

    return max(
        map(
            call,
            [
                ["isort", *ALL_PY],
                ["black", *ALL_PY],
                ["flake8", *ALL_PY],
                *[
                    # see https://github.com/python/mypy/issues/4008
                    ["mypy", *paths]
                    for paths in PY_SRC_PACKAGES.values()
                ],
                # ["pylint", *ALL_PY],
                ["robotidy", *ALL_ROBOT],
                ["robocop", *ROBOCOP_ARGS, *ALL_ROBOT],
                ["python", "scripts/atest.py", "--dryrun", "--console", "dotted"],
                ["python", "scripts/nblint.py"],
            ],
        )
    )


if __name__ == "__main__":
    sys.exit(lint())
