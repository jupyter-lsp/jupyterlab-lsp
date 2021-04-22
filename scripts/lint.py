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

ALL_ROBOT = [
    r
    for r in (ROOT / "atest").rglob("*.robot")
    if not (r.name in ["example.robot"] or "checkpoint" in str(r))
]


# TODO: explore adopting these conventions
ROBOCOP_EXCLUDES = [
    "empty-lines-between-sections",
    "if-can-be-used",
    "missing-doc-keyword",
    "missing-doc-suite",
    "missing-doc-testcase",
    "not-capitalized-keyword-name",
    "too-long-test-case",
    "too-many-arguments",
    "too-many-calls-in-keyword",
    "too-many-calls-in-test-case",
    "file-too-long",
    "redundant-equal-sign",
]

ROBOCOP_CONFIGS = ["line-too-long:line_length:200"]

ROBOCOP = sum(
    [
        *[["--exclude", e] for e in ROBOCOP_EXCLUDES],
        *[["--configure", c] for c in ROBOCOP_CONFIGS],
    ],
    [],
)


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
                ["python", "-m", "robot.tidy", "--inplace", *ALL_ROBOT],
                ["robocop", *ROBOCOP, *ALL_ROBOT],
                ["python", "scripts/atest.py", "--dryrun", "--console", "dotted"],
                ["python", "scripts/nblint.py"],
            ],
        )
    )


if __name__ == "__main__":
    sys.exit(lint())
