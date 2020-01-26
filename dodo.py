""" top-level automation for jupyter[lab]-lsp

To run _everything_

    doit

To just run one task_<name> (and any requirements):

    doit <name>

TODO:
    - investigate better output mechanisms (reports)
"""
import platform
import shutil
import sys
from pathlib import Path

DODO = Path(__file__)
ROOT = DODO.parent

# base sources
ATEST = ROOT / "atest"
BINDER = ROOT / "binder"
CI = ROOT / "ci"
DOCS = ROOT / "docs"
PACKAGES = ROOT / "packages"
PY_ROOT = ROOT / "py_src"
REQS = ROOT / "requirements"
SCRIPTS = ROOT / "scripts"

# we're going to build here
# TODO: make this a task?
BUILD = ROOT / "build"
BUILD.exists() or BUILD.mkdir()

# python concerns
PY_SETUP = ROOT / "setup.py"
PY_META = [ROOT / "setup.cfg", ROOT / "MANIFEST.in", PY_SETUP]
PY_SRC = [*PY_ROOT.rglob("*.py")]
PY_SCRIPTS = [*SCRIPTS.rglob("*.py")]
PY_ATEST = [*ATEST.glob("*.py")]
PY_JSON = [*PY_ROOT.rglob("*.json")]
PY_EGGINFO = PY_ROOT / "jupyter_lsp.egg-info"
PY_EGG_PKG = PY_EGGINFO / "PKG-INFO"
ALL_PY = [*PY_SRC, *PY_SCRIPTS, *PY_ATEST, PY_SETUP, DODO]
PY_SDIST = ROOT / "build" / "*.tar.gz"
PY_WHEEL = ROOT / "build" / "*.whl"


def task_py_setup():
    def clean():
        [
            dr.exists() and shutil.rmtree(dr)
            for dr in [PY_EGGINFO, *PY_ROOT.rglob("__pycache__")]
        ]

    return {
        "file_dep": PY_META,
        "targets": [PY_EGGINFO],
        "actions": [f"python -m pip install -e . --ignore-installed --no-deps"],
        "clean": [clean],
    }


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
        "file_dep": [_FLAKED, _BLACKENED, *PY_SRC],
        "targets": [_MYPYED],
        "actions": [f"mypy {_(PY_SRC)} > {_MYPYED}"],
        "clean": [clean],
    }


COVERAGE = ROOT / ".coverage"
PYTEST_CACHE = ROOT / ".pytest_cache"


def task_utest():
    def clean():
        shutil.rmtree(PYTEST_CACHE, ignore_errors=True)
        COVERAGE.exists() and COVERAGE.unlink()

    return {
        "file_dep": [*PY_SRC, *PY_JSON, *PY_META, _JLPMED, PY_EGG_PKG],
        "targets": [COVERAGE, PYTEST_CACHE],
        "actions": [f"python scripts/utest.py"],
        "clean": [clean],
    }


# robot concerns
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

_ROBOTIDIED = BUILD / "robotidy.log"


def task_robot_tidy():
    return {
        "file_dep": ALL_ROBOT,
        "targets": [_ROBOTIDIED],
        "actions": [f"python -m robot.tidy --inplace {_(ALL_ROBOT)} > {_ROBOTIDIED}"],
        "clean": True,
    }


ROBOT_DRYRUN = [*(ATEST / "output").glob("dry_run_*")]


def task_robot_dryrun():
    def clean():
        [shutil.rmtree(dr) if dr.is_dir() else dr.unlink() for dr in ROBOT_DRYRUN]

    return {
        "file_dep": [_ROBOTIDIED, *ALL_ROBOT],
        "targets": ROBOT_DRYRUN,
        "actions": [f"python scripts/atest.py --dryrun --name 'Dry Run'"],
        "clean": [clean],
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
        "file_dep": [*ROBOT_DRYRUN, *ALL_ROBOT],
        "targets": [_RFLINTED],
        "actions": [f"rflint {args} {_(ALL_ROBOT)} > {_RFLINTED}"],
        "clean": True,
    }


# js concerns
PACKAGE_JSONS = [ROOT / "package.json", *PACKAGES.glob("*/package.json")]
NODE_MODULES = ROOT / "node_modules"

_JLPMED = BUILD / "jlpm.install.log"


def task_jsdeps():
    def clean():
        shutil.rmtree(NODE_MODULES, ignore_errors=True)
        _JLPMED.exists() and _JLPMED.unlink()

    return {
        "file_dep": [*PACKAGE_JSONS],
        "targets": [_JLPMED],
        "actions": [f"jlpm --no-optional --prefer-offline > {_JLPMED}"],
        "clean": [clean],
    }


# prettier concerns
# TODO: .prettierignore is complicated, need a better solution
_PRETTIED = BUILD / "prettier.log"

ALL_MD = [*ROOT.glob("*.md"), *DOCS.rglob("*.md")]
ALL_JSON = [*ROOT.glob("*.json"), *PY_JSON, *PACKAGES.rglob("*.json")]
ALL_TS = [*PACKAGES.rglob("*.ts"), *PACKAGES.rglob("*.tsx")]
ALL_CSS = [*PACKAGES.rglob("*.css"), *DOCS.rglob("*.css")]
ALL_PRETTIER = [*ALL_MD, *ALL_JSON, *ALL_TS, *ALL_CSS]
ALL_YAML = [
    *ROOT.glob("*.yml"),
    *REQS.glob("*.yml"),
    *BINDER.glob("*.yml"),
    *CI.rglob("*.yml"),
]


def task_prettier():
    return {
        "file_dep": [*ALL_PRETTIER, _JLPMED, DTS_SCHEMA],
        "targets": [_PRETTIED],
        "actions": [f"jlpm prettier > {_PRETTIED}"],
        "clean": True,
    }


# typescript-only concerns
TS_WS = PACKAGES / "lsp-ws-connection"
TS_META = PACKAGES / "metapackage"
TS_LSP = PACKAGES / "jupyterlab-lsp"

_TSLINTED = BUILD / "tslint.log"


def task_tslint():
    return {
        "file_dep": [_PRETTIED],
        "targets": [_TSLINTED],
        "actions": [f"jlpm tslint > {_TSLINTED}"],
        "clean": True,
    }


DTS_SCHEMA = TS_LSP / "src" / "_schema.d.ts"


def task_ts_schema():
    return {
        "file_dep": [*PY_JSON, _JLPMED],
        "targets": [DTS_SCHEMA],
        "actions": [f"jlpm build:schema"],
        "clean": True,
    }


TS_BUILDINFO = [*PACKAGES.glob("*/lib/.tsbuildinfo")]


def task_tsc():
    libs = [TS_LSP / "lib", TS_WS / "lib", TS_META / "lib"]

    def clean():
        [shutil.rmtree(libs, ignore_errors=True) for dr in libs]

    return {
        "file_dep": [DTS_SCHEMA],
        "targets": [*libs],
        "actions": [f"jlpm build:meta"],
        "clean": [clean],
    }


_WEBPACKED = BUILD / "lsp-ws-connection.webpack.log"


def task_ws_webpack():
    def clean():
        shutil.rmtree(TS_WS / "dist", ignore_errors=True)
        _WEBPACKED.exists() and _WEBPACKED.unlink()

    return {
        "file_dep": TS_BUILDINFO,
        "targets": [_WEBPACKED, TS_WS / "dist"],
        "actions": [f"jlpm build:ws > {_WEBPACKED}"],
        "clean": [clean],
    }


WS_JUNIT = TS_LSP.glob("*/junit.xml")


def task_wstest():
    return {
        "file_dep": TS_BUILDINFO,
        "targets": [*WS_JUNIT],
        "actions": [f"jlpm test --scope lsp-ws-connection"],
        "clean": True,
    }


LSP_JUNIT = TS_LSP / "junit.xml"


def task_lsptest():
    return {
        "file_dep": TS_BUILDINFO,
        "targets": [LSP_JUNIT],
        "actions": [f"jlpm test --scope @krassowski/jupyterlab-lsp"],
        "clean": True,
    }


# acceptance-testing concerns

OS = platform.system()
PY = "".join(map(str, sys.version_info[:2]))
ATEST_OUTPUT = ATEST / "output"
ATEST_OUTPUTS = ATEST_OUTPUT.glob(f"{OS}_{PY}*".lower())
ATEST_COMBINED = [ATEST_OUTPUT / "log.html", ATEST_OUTPUT / "report.html"]


def task_atest():
    def clean():
        [shutil.rmtree(dr) if dr.is_dir() else dr.unlink() for dr in ATEST_OUTPUTS]

    return {
        "file_dep": [
            COVERAGE,
            *WS_JUNIT,
            LSP_JUNIT,
            _LABBUILT,
            _RFLINTED,
            _SERVEREXTENDED,
        ],
        "targets": [*ATEST_OUTPUTS],
        "actions": [f"python scripts/atest.py"],
        "clean": [clean],
    }


def task_atest_combine():
    return {
        "file_dep": [*ATEST_OUTPUTS, *ROBOT_DRYRUN],
        "targets": ATEST_COMBINED,
        "actions": [f"python scripts/combine.py"],
        "clean": True,
    }


# development concerns

_SERVEREXTENDED = BUILD / "serverextension.log"


def task_serverextension():
    return {
        "file_dep": [PY_EGG_PKG],
        "targets": [_SERVEREXTENDED],
        "actions": [
            f"jupyter serverextension enable --sys-prefix --py jupyter_lsp"
            f" > {_SERVEREXTENDED}"
        ],
        "clean": True,
    }


_LABEXTENDED = BUILD / "labextensions.log"


def task_lab_link():
    return {
        "file_dep": [_WEBPACKED],
        "targets": [_LABEXTENDED],
        "actions": [f"jlpm lab:link > {_LABEXTENDED}"],
        "clean": True,
    }


_LABBUILT = BUILD / "labbuilt.log"


def task_lab_build():
    return {
        "file_dep": [_LABEXTENDED],
        "targets": [_LABBUILT],
        "actions": [
            f"jupyter lab build --dev-build=False --minimize=True > {_LABBUILT}"
        ],
        "clean": True,
    }


# release concerns

_INTEGRATED = BUILD / "integrity.log"


def task_integrity():
    return {
        "file_dep": [*ALL_YAML, *ALL_JSON, *ALL_TS, *ALL_PY, *ALL_MD],
        "targets": [_INTEGRATED],
        "actions": [f"python scripts/integrity.py > {_INTEGRATED}"],
        "clean": True,
    }


def task_py_dist():
    return {
        "file_dep": [*PY_SRC, *PY_JSON, *PY_META, ROOT / "README.md"],
        "targets": [PY_SDIST, PY_WHEEL],
        "actions": ["python setup.py sdist", "python setup.py bdist_wheel"],
        "clean": True,
    }


def task_js_dist():
    return {
        "file_dep": [_WEBPACKED],
        "targets": [*PACKAGES.glob("*.tgz")],
        "actions": ["jlpm bundle"],
        "clean": True,
    }


# utilities


def _(paths):
    """ utility to make paths string-friendly
    """
    return " ".join(sorted(map(str, paths)))
