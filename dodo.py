""" top-level automation for jupyter[lab]-lsp

To run _everything_

    doit

To just run one task_<name> (and any requirements):

    doit <name>

TODO:
    - investigate better output mechanisms (reports)
"""
import json
import platform
import re
import shutil
import sys
from pathlib import Path

DODO = Path(__file__)
ROOT = DODO.parent

# base sources
ATEST = ROOT / "atest"
BINDER = ROOT / "binder"
CI = ROOT / "ci"
DIST = ROOT / "dist"
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

PY_VERSION = re.findall(
    r'= "(.*)"$', (PY_ROOT / "jupyter_lsp" / "_version.py").read_text()
)[0]

PY_SDIST = [DIST / "jupyter-lsp-{}.tar.gz".format(PY_VERSION)]
PY_WHEEL = [DIST / "jupyter_lsp-{}-py3-none-any.whl".format(PY_VERSION)]


def task_py_setup():
    """ do a local dev install of jupyter_lsp
    """

    def clean():
        [
            dr.exists() and shutil.rmtree(dr)
            for dr in [PY_EGGINFO, *PY_ROOT.rglob("__pycache__")]
        ]

    return {
        "file_dep": PY_META,
        "targets": [PY_EGG_PKG],
        "actions": [
            [
                "python",
                "-m",
                "pip",
                "install",
                "-e",
                ".",
                "--ignore-installed",
                "--no-deps",
            ]
        ],
        "clean": [clean],
    }


_ISORTED = BUILD / "isort.log"


def task_isort():
    """ sort all imports
    """
    return {
        "file_dep": ALL_PY,
        "targets": [_ISORTED],
        "actions": [["isort", "-rc", *ALL_PY], _ISORTED.touch],
        "clean": True,
    }


_BLACKENED = BUILD / "black.log"


def task_black():
    """ blacken all python (except intentionally-broken things for test)
    """
    return {
        "file_dep": [_ISORTED, *ALL_PY],
        "targets": [_BLACKENED],
        "actions": [["black", *ALL_PY], _BLACKENED.touch],
        "clean": True,
    }


_FLAKED = BUILD / "flake8.log"


def task_flake8():
    """ check python source for common typos
    """

    return {
        "file_dep": [_BLACKENED, *ALL_PY],
        "targets": [_FLAKED],
        "actions": [["flake8", *ALL_PY], _FLAKED.touch],
        "clean": True,
    }


_MYPYED = BUILD / "mypy.log"
_MYPY_CACHE = ROOT / ".mypy_cache"


def task_mypy():
    """ typecheck python source
    """

    def clean():
        shutil.rmtree(_MYPY_CACHE, ignore_errors=True)
        _MYPYED.exists() and _MYPYED.unlink()

    return {
        "file_dep": [_FLAKED, _BLACKENED, *PY_SRC],
        "targets": [_MYPYED],
        "actions": [["mypy", *PY_SRC], _MYPYED.touch],
        "clean": [clean],
    }


COVERAGE = ROOT / ".coverage"
PYTEST_CACHE = ROOT / ".pytest_cache"


def task_utest():
    """ run backend unit tests
    """

    def clean():
        shutil.rmtree(PYTEST_CACHE, ignore_errors=True)
        COVERAGE.exists() and COVERAGE.unlink()

    return {
        "file_dep": [*PY_SRC, *PY_JSON, *PY_META, _JLPMED, PY_EGG_PKG],
        "targets": [COVERAGE, PYTEST_CACHE],
        "actions": [["python", "scripts/utest.py"]],
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
    """ apply source formatting for robot
    """
    return {
        "file_dep": ALL_ROBOT,
        "targets": [_ROBOTIDIED],
        "actions": [
            ["python", "-m", "robot.tidy", "--inplace", *ALL_ROBOT],
            _ROBOTIDIED.touch,
        ],
        "clean": True,
    }


ROBOT_DRYRUN = [
    ATEST / "output" / "dry_run.log.html",
    ATEST / "output" / "dry_run.report.html",
    ATEST / "output" / "dry_run.xunit.xml",
    ATEST / "output" / "dry_run.robot.xml",
]


def task_robot_dryrun():
    """ run through robot tests without actually doing anything
    """

    def clean():
        [
            shutil.rmtree(dr) if dr.is_dir() else dr.unlink()
            for dr in ROBOT_DRYRUN
            if dr.exists()
        ]

    return {
        "file_dep": [_ROBOTIDIED, *ALL_ROBOT],
        "targets": [*ROBOT_DRYRUN],
        "actions": [["python", "scripts/atest.py", "--dryrun"]],
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
    """ apply robotframework-lint to all robot files
    """
    return {
        "file_dep": [*ROBOT_DRYRUN, *ALL_ROBOT],
        "targets": [_RFLINTED],
        "actions": [["rflint", *RFLINT, *ALL_ROBOT], _RFLINTED.touch],
        "clean": True,
    }


# js concerns
PACKAGE_JSONS = [ROOT / "package.json", *PACKAGES.glob("*/package.json")]
NODE_MODULES = ROOT / "node_modules"

_JLPMED = BUILD / "jlpm.install.log"


def task_jsdeps():
    """ install npm dependencies
    """

    def clean():
        shutil.rmtree(NODE_MODULES, ignore_errors=True)
        _JLPMED.exists() and _JLPMED.unlink()

    return {
        "file_dep": [*PACKAGE_JSONS],
        "targets": [_JLPMED],
        "actions": [["jlpm", "--no-optional", "--prefer-offline"], _JLPMED.touch],
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

_PRETTIER_NEEDED = BUILD / "prettier-different.log"


def task_needs_prettier():
    """ determine if prettier needs to be run
    """
    return {
        "file_dep": [*ALL_PRETTIER, _JLPMED, DTS_SCHEMA],
        "targets": [_PRETTIER_NEEDED],
        "actions": [
            ["jlpm", "--silent", "prettier", "--list-different"],
            _PRETTIER_NEEDED.touch,
        ],
        "clean": True,
    }


def task_prettier():
    """ apply prettier to source files
    """
    return {
        "file_dep": [_PRETTIER_NEEDED],
        "targets": [_PRETTIED],
        "actions": [["jlpm", "prettier:fix"], _PRETTIED.touch],
        "clean": True,
        "verbosity": 2,
    }


# typescript-only concerns
TS_WS = PACKAGES / "lsp-ws-connection"
TS_META = PACKAGES / "metapackage"
TS_LSP = PACKAGES / "jupyterlab-lsp"

_TSLINTED = BUILD / "tslint.log"


def task_tslint():
    """ fix and lint typescript
    """
    return {
        "file_dep": [_PRETTIED],
        "targets": [_TSLINTED],
        "actions": [["jlpm", "tslint:fix"], _TSLINTED.touch],
        "clean": True,
    }


DTS_SCHEMA = TS_LSP / "src" / "_schema.d.ts"


def task_ts_schema():
    """ create typings for server schema
    """
    return {
        "file_dep": [*PY_JSON, _JLPMED],
        "targets": [DTS_SCHEMA],
        "actions": [["jlpm", "build:schema"]],
        "clean": True,
    }


TS_BUILDINFO = [
    p / "lib" / ".tsbuildinfo"
    for p in PACKAGES.glob("*/")
    if (p / "package.json").exists()
]


def task_tsc():
    """ transpile all typescript
    """
    libs = [TS_LSP / "lib", TS_WS / "lib", TS_META / "lib"]

    def clean():
        [shutil.rmtree(libs, ignore_errors=True) for dr in libs]

    return {
        "file_dep": [DTS_SCHEMA],
        "targets": TS_BUILDINFO,
        "actions": [["jlpm", "build:meta"]],
        "clean": [clean],
    }


WS_DIST = [TS_WS / "dist" / "index.js"]


def task_ws_webpack():
    """ build the lsp-ws-connection webpack bundle
    """

    def clean():
        shutil.rmtree(TS_WS / "dist", ignore_errors=True)

    return {
        "file_dep": TS_BUILDINFO,
        "targets": WS_DIST,
        "actions": [["jlpm", "build:ws"]],
        "clean": [clean],
    }


WS_JUNIT = TS_WS / "junit.xml"


def task_wstest():
    """ test lsp-ws-connection
    """
    return {
        "file_dep": WS_DIST,
        "targets": [WS_JUNIT],
        "actions": [["jlpm", "test", "--scope", "lsp-ws-connection"]],
        "clean": True,
    }


LSP_JUNIT = TS_LSP / "junit.xml"


def task_lsptest():
    """ test jupyterlab-lsp
    """

    return {
        "file_dep": [WS_JUNIT],
        "targets": [LSP_JUNIT],
        "actions": [["jlpm", "test", "--scope", "@krassowski/jupyterlab-lsp"]],
        "clean": True,
    }


# acceptance-testing concerns

OS = platform.system()
PY = "".join(map(str, sys.version_info[:2]))
ATEST_OUTPUT = ATEST / "output"
ATEST_OUTPUTS = ATEST_OUTPUT.glob(f"{OS}_{PY}*".lower())
ATEST_COMBINED = [ATEST_OUTPUT / "log.html", ATEST_OUTPUT / "report.html"]


_ATESTED = BUILD / "atest.log"


def task_atest():
    """ run browser-based acceptance tests
    """

    def clean():
        [shutil.rmtree(dr) if dr.is_dir() else dr.unlink() for dr in ATEST_OUTPUTS]
        _ATESTED.exists() and _ATESTED.unlink()

    return {
        "file_dep": [_LABBUILT, _SERVEREXTENDED],
        "targets": [*ATEST_OUTPUTS, _ATESTED],
        "actions": [["python", "scripts/atest.py"], _ATESTED.touch],
        "clean": [clean],
        "verbosity": 2,
    }


def task_atest_combine():
    """ combine all robot report outputs
    """
    return {
        "file_dep": [_ATESTED, *ROBOT_DRYRUN],
        "targets": [*ATEST_COMBINED],
        "actions": [["python", "scripts/combine.py"]],
        "clean": True,
        "verbosity": 2,
    }


# development concerns

_SERVEREXTENDED = BUILD / "serverextension.log"


def task_serverextension():
    """ install the serverextension
    """
    return {
        "file_dep": [PY_EGG_PKG],
        "targets": [_SERVEREXTENDED],
        "actions": [
            [
                "jupyter",
                "serverextension",
                "enable",
                "--sys-prefix",
                "--py",
                "jupyter_lsp",
            ],
            "jupyter serverextension list > {}".format(_SERVEREXTENDED),
        ],
        "clean": True,
    }


_LABLISTED = BUILD / "lab.list.log"


def task_lab_list():
    """ list labextensiosn
    """

    return {
        "file_dep": [*WS_DIST, *TS_BUILDINFO],
        "targets": [_LABLISTED],
        "actions": _lab_list(_LABLISTED),
        "clean": True,
    }


_LABEXTENDED = BUILD / "lab.linked.log"


def task_lab_link():
    """ link all labextensions
    """
    return {
        "file_dep": [*WS_DIST, *TS_BUILDINFO, _LABLISTED],
        "targets": [_LABEXTENDED],
        "actions": [["jlpm", "lab:link"]] + _lab_list(_LABEXTENDED),
        "clean": True,
    }


_LABBUILT = BUILD / "lab.built.log"


def task_lab_build():
    """ do a production build of jupyterlab
    """

    return {
        "file_dep": [_LABEXTENDED],
        "targets": [_LABBUILT],
        "actions": [
            ["jupyter", "lab", "build", "--dev-build=False", "--minimize=True"],
        ]
        + _lab_list(_LABBUILT),
        "clean": True,
    }


# release concerns

_INTEGRATED = BUILD / "integrity.log"


def task_integrity():
    """ check integrity of versions, etc.
    """
    return {
        "file_dep": [*ALL_YAML, *ALL_JSON, *ALL_TS, *ALL_PY, *ALL_MD],
        "targets": [_INTEGRATED],
        "actions": [["python", "scripts/integrity.py"], _INTEGRATED.touch],
        "clean": True,
    }


def task_py_dist():
    """ build pypi release assets
    """

    lib = BUILD / "lib"
    dists = [*PY_SDIST, *PY_WHEEL]
    bdist = [*BUILD.glob("bdist.*")]

    def clean():
        [dist.exists() and dist.unlink() for dist in dists]
        [dr.is_dir() and shutil.rmtree(dr) for dr in [lib, *bdist]]

    return {
        "file_dep": [*PY_SRC, *PY_JSON, *PY_META, ROOT / "README.md"],
        "targets": dists,
        "actions": [
            ["python", "setup.py", "sdist"],
            ["python", "setup.py", "bdist_wheel"],
        ],
        "clean": [clean],
    }


JS_TARBALLS = [
    path.parent
    / "{}-{}.tgz".format(
        package["name"].replace("@", "").replace("/", "-"), package["version"]
    )
    for path, package in [
        (path, json.loads(path.read_text())) for path in PACKAGE_JSONS
    ]
    if package.get("version") and "metapackage" not in package["name"]
]


def task_js_dist():
    """ build npm release assets
    """
    return {
        "file_dep": WS_DIST,
        "targets": JS_TARBALLS,
        "actions": [["jlpm", "bundle"]],
        "clean": True,
    }


_RELEASABLE = BUILD / "releasable.log"

# convenience tasks


def task_RELEASE():
    """ get a release ready
    """

    return {
        "file_dep": [_INTEGRATED, *PY_SDIST, *PY_WHEEL, *JS_TARBALLS],
        "targets": [_RELEASABLE],
        "actions": [lambda: print("release ok!"), _RELEASABLE.touch],
        "clean": True,
    }


_LABBED = BUILD / "lab.log"


def task_LAB():
    """ get a lab ready to run. good for development.
    """
    return {
        "file_dep": [_SERVEREXTENDED, _LABBUILT],
        "targets": [_LABBED],
        "actions": [_LABBED.touch],
        "clean": True,
    }


_LINTED = BUILD / "lint.log"


def task_LINT():
    """ lint everything. good before committing.
    """
    return {
        "file_dep": [_MYPYED, _RFLINTED, _TSLINTED],
        "targets": [_LINTED],
        "actions": [_LINTED.touch],
        "clean": True,
    }


def task_ALL():
    """ run everything. good for reviewing.
    """
    return {
        "file_dep": [
            _ATESTED,
            _RELEASABLE,
            _LINTED,
            *ATEST_COMBINED,
            COVERAGE,
            LSP_JUNIT,
        ],
        "actions": [lambda: print("ok!")],
    }


# utilities


def _lab_list(output):
    """ return an action that lists the current jupyterlab build state
    """
    return ["jupyter labextension list > {}".format(output)]
