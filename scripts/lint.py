""" code quality countermeasures
"""
# flake8: noqa: W503
import sys
from pathlib import Path
from subprocess import call

OK = 0
FAIL = 1

ROOT = Path(__file__).parent.parent

PY_SRC = [
    path
    for path in (ROOT / "py_src").rglob("*.py")
    if ".ipynb_checkpoints" not in str(path)
]
PY_SCRIPTS = list((ROOT / "scripts").rglob("*.py"))
PY_DOCS = list((ROOT / "docs").rglob("*.py"))
PY_ATEST = list((ROOT / "atest").glob("*.py"))

ALL_PY = [*PY_SRC, *PY_SCRIPTS, *PY_ATEST, *PY_DOCS]

ALL_ROBOT = list((ROOT / "atest").rglob("*.robot"))

RFLINT_RULES = [
    "LineTooLong:200",
    "TooFewKeywordSteps:0",
    "TooFewTestSteps:1",
    "TooManyTestSteps:30",
    "TooManyTestCases:13",
]

RFLINT_IGNORES = [
    "RequireKeywordDocumentation",
    "RequireSuiteDocumentation",
    "RequireTestDocumentation",
]

RFLINT = sum(
    [["--configure", rule] for rule in RFLINT_RULES]
    + [["--ignore", rule] for rule in RFLINT_IGNORES],
    [],
)


def lint():
    """ get that linty fresh feeling
    """

    return max(
        map(
            call,
            [
                ["isort", "-rc", *ALL_PY],
                ["black", *ALL_PY],
                ["flake8", *ALL_PY],
                # ["pylint", *ALL_PY],
                ["mypy", *PY_SRC],
                ["python", "-m", "robot.tidy", "--inplace", *ALL_ROBOT],
                ["rflint", *RFLINT, *ALL_ROBOT],
                ["python", "scripts/atest.py", "--dryrun", "--console", "quiet"],
            ],
        )
    )


if __name__ == "__main__":
    sys.exit(lint())
