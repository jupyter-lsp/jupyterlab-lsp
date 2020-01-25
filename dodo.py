""" top-level automation for jupyter[lab]-lsp

To run _everything_

    doit

To just run one task_<name> (and any requirements):

    doit <name>

"""
import shutil
from pathlib import Path

DODO = Path(__file__)
ROOT = DODO.parent
BUILD = ROOT / "build"

PY_SRC = list((ROOT / "py_src").rglob("*.py"))
PY_SCRIPTS = list((ROOT / "scripts").rglob("*.py"))
PY_ATEST = list((ROOT / "atest").glob("*.py"))
ALL_PY = [DODO, *PY_SRC, *PY_SCRIPTS, *PY_ATEST]

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

# we're going to build here
BUILD.exists() or BUILD.mkdir()


# TODO: investigate better output mechanisms (reports)
_ISORTED = BUILD / "isort.log"


def task_isort():
    """"sort all imports"""
    return {
        "file_dep": ALL_PY,
        "targets": [_ISORTED],
        "actions": [f"isort -rc {_(ALL_PY)} > {_ISORTED}"],
        "clean": True,
    }


_BLACKENED = BUILD / "black.log"


def task_black():
    """blacken all python (except intentionally-broken things for test)"""
    return {
        "file_dep": [_ISORTED, *ALL_PY],
        "targets": [_BLACKENED],
        "actions": [f"black {_(ALL_PY)} > {_BLACKENED}"],
        "clean": True,
    }


_FLAKED = BUILD / "flake8.log"


def task_flake8():
    return {
        "file_dep": [_BLACKENED, *ALL_PY],
        "targets": [_FLAKED],
        "actions": [f"flake8 {_(ALL_PY)} > {_FLAKED}"],
        "clean": True,
    }


_MYPYED = BUILD / "mypy.log"
_MYPY_CACHE = ROOT / ".mypy_cache"


def task_mypy():
    def clean():
        shutil.rmtree(_MYPY_CACHE, ignore_errors=True)
        _MYPYED.exists() and _MYPYED.unlink()

    return {
        "file_dep": [_FLAKED, *PY_SRC],
        "targets": [_MYPYED],
        "actions": [f"mypy {_(PY_SRC)} > {_MYPYED}"],
        "clean": [clean],
    }


_ROBOTIDIED = BUILD / "robotidy.log"


def task_robot_tidy():
    return {
        "file_dep": ALL_ROBOT,
        "targets": [_ROBOTIDIED],
        "actions": [f"python -m robot.tidy --inplace {_(ALL_ROBOT)} > {_ROBOTIDIED}"],
        "clean": True,
    }


_ROBOTDRYRAN = BUILD / "robotdryrun.log"


def task_robot_dryrun():
    return {
        "file_dep": [_ROBOTIDIED, *ALL_ROBOT],
        "targets": [_ROBOTDRYRAN],
        "actions": [f"python scripts/atest.py --dryrun > {_ROBOTDRYRAN}"],
        "clean": True,
    }


_RFLINTED = BUILD / "rflint.log"

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


def task_robot_lint():
    args = " ".join(RFLINT)
    return {
        "file_dep": [_ROBOTDRYRAN, *ALL_ROBOT],
        "targets": [_RFLINTED],
        "actions": [f"rflint {args} {_(ALL_ROBOT)} > {_RFLINTED}"],
        "clean": True,
    }


# utilities


def _(paths):
    """ utility to make paths string-friendly
    """
    return " ".join(sorted(map(str, paths)))
