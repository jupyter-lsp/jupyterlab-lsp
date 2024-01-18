""" code quality countermeasures
"""
# flake8: noqa: W503
import sys
from pathlib import Path
from subprocess import call

HAS_ROBOT = False

try:
    import robot

    HAS_ROBOT = True
except ImportError:
    pass


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
    for ext in ["robot", "resource"]
    for r in (ROOT / "atest").rglob(f"*.{ext}")
    if not (r.name in ["example.robot"] or "checkpoint" in str(r))
]


# TODO: explore adopting these conventions
ROBOCOP_EXCLUDES = [
    "empty-lines-between-sections",
    "expression-can-be-simplified",
    "file-too-long",
    "missing-doc-keyword",
    "missing-doc-suite",
    "missing-doc-test-case",
    "missing-doc-resource-file",
    "replace-create-with-var",
    "replace-set-variable-with-var",
    "todo-in-comment",
    "too-long-keyword",
    "too-long-test-case",
    "too-many-arguments",
    "too-many-calls-in-keyword",
    "too-many-calls-in-test-case",
    "unused-variable",
    "wrong-case-in-keyword-name",
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

    def call_with_print(args):
        str_args = [a for a in args if isinstance(a, str)]
        paths = [a for a in args if isinstance(a, Path)]
        print(f"{len(paths)} paths:", " ".join(str_args))
        return_code = call(list(map(str, args)))
        if return_code:
            print("\n...", f"ERROR {return_code}", *str_args, "\n")
        return return_code

    linters = [
        ["isort", *ALL_PY],
        ["black", "--quiet", *ALL_PY],
        ["flake8", *ALL_PY],
        *[["mypy", *paths] for paths in PY_SRC_PACKAGES.values()],
        ["python", "scripts/nblint.py"],
    ]

    if HAS_ROBOT:
        linters += [
            ["python", "scripts/atest.py", "--dryrun", "--console", "dotted"],
            ["robotidy", *ALL_ROBOT],
            ["robocop", *ROBOCOP, *ALL_ROBOT],
        ]

    return max(map(call_with_print, linters))


if __name__ == "__main__":
    sys.exit(lint())
