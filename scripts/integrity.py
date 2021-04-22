""" check internal version consistency

    these should be quick to run (not invoke any other process)
"""
# pylint: disable=redefined-outer-name,unused-variable

import json
import pathlib
import re
import sys
import tempfile
from configparser import ConfigParser
from importlib.util import find_spec
from typing import Dict
from warnings import warn

import jsonschema
import nbformat
import pytest
from nbconvert.preprocessors import ExecutePreprocessor
from packaging.requirements import Requirement
from packaging.specifiers import SpecifierSet
from packaging.version import Version

try:
    import ruamel.yaml as yaml
except ImportError:
    import ruamel_yaml as yaml

ROOT = pathlib.Path.cwd()

sys.path.insert(0, str(ROOT))

if True:
    # a workaround for isort 4.0 limitations
    # see https://github.com/timothycrosley/isort/issues/468
    from versions import JUPYTER_LSP_VERSION as PY_SERVER_VERSION
    from versions import REQUIRED_JUPYTER_SERVER  # noqa
    from versions import REQUIRED_JUPYTERLAB as LAB_SPEC  # noqa
    from versions import RF_LSP_VERSION as RFLSP  # noqa

REQS = ROOT / "requirements"
BINDER = ROOT / "binder"
BINDER_ENV = BINDER / "environment.yml"

# docs
MAIN_README = ROOT / "README.md"
CHANGELOG = ROOT / "CHANGELOG.md"
CONTRIBUTING = ROOT / "CONTRIBUTING.md"

# TS stuff
NPM_NS = "@krassowski"
PACKAGES = {
    package["name"]: [path.parent, package]
    for path, package in [
        (path, json.loads(path.read_text(encoding="utf-8")))
        for path in ROOT.glob("packages/*/package.json")
    ]
}

META_NAME = f"{NPM_NS}/jupyterlab-lsp-metapackage"

JS_LSP_NAME = f"{NPM_NS}/jupyterlab-lsp"
JS_LSP_VERSION = PACKAGES[JS_LSP_NAME][1]["version"]

JS_CJS_NAME = f"{NPM_NS}/code-jumpers"
JS_CJS_VERSION = PACKAGES[JS_CJS_NAME][1]["version"]

PY_PATH = ROOT / "python_packages"
PY_SERVER_PATH = PY_PATH / "jupyter_lsp"
PY_FRONT_PATH = PY_PATH / "jupyterlab_lsp"

# py stuff
PY_SERVER_NAME = "jupyter-lsp"
PY_FRONT_NAME = "jupyterlab-lsp"


# CI stuff
PIPE_FILE = ROOT / ".github/workflows/job.test.yml"
PIPELINES = yaml.safe_load(PIPE_FILE.read_text(encoding="utf-8"))
PIPE_VARS = PIPELINES["env"]
DOCS = ROOT / "docs"

CI = ROOT / ".github/workflows"

PYTEST_INI = """
[pytest]
junit_family=xunit2
"""


@pytest.fixture(scope="module")
def the_meta_package():
    """loads up the files in the metapackage that might be out-of-date"""
    meta_path, meta = PACKAGES[META_NAME]
    return (
        meta_path,
        meta,
        json.loads((meta_path / "tsconfig.json").read_text(encoding="utf-8")),
        (meta_path / "src" / "index.ts").read_text(encoding="utf-8"),
    )


@pytest.fixture(scope="module")
def the_contributing_doc():
    return CONTRIBUTING.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def the_binder_env():
    return yaml.safe_load(BINDER_ENV.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def the_installation_notebook():
    """executes and loads up the installation notebook"""
    with open(DOCS / "Installation.ipynb") as f:
        installation_nb = nbformat.read(f, as_version=4)
    executor = ExecutePreprocessor(timeout=600)

    # modifies notebook in-place
    executor.preprocess(installation_nb, {"metadata": {"path": DOCS}})

    return nbformat.writes(installation_nb)


@pytest.mark.parametrize(
    "name,info", [p for p in PACKAGES.items() if p[0] != META_NAME]
)
def test_ts_package_integrity(name, info, the_meta_package):
    """are the versions of the frontend packages consistent and in the metapackage?"""
    m_path, m_pkg, m_tsconfig, m_index = the_meta_package
    path, pkg = info

    assert (
        name in m_pkg["dependencies"]
    ), f"{name} missing from metapackage/package.json"

    assert (
        "'{}'".format(name) in m_index
    ), f"{name} missing from metapackage/src/index.ts"

    assert [
        ref for ref in m_tsconfig["references"] if ref["path"] == f"../{path.name}"
    ], f"{name} missing from metapackage/tsconfig.json"

    schemas = list(path.glob("schema/*.json"))

    if schemas:
        for schema in schemas:
            schema_instance = json.loads(schema.read_text(encoding="utf-8"))
            jsonschema.validators.Draft7Validator(schema_instance)


@pytest.mark.parametrize(
    "path",
    map(
        str,
        [
            REQS / "lab.txt",
            CI / "job.test.yml",
            MAIN_README,
            BINDER / "environment.yml",
            DOCS / "rtd.yml",
        ],
    ),
)
def test_jlab_versions(path):
    """is the version of jupyterlab consistent?"""
    assert (
        LAB_SPEC in pathlib.Path(path).read_text(encoding="utf-8").lower()
    ), f"{path} lab version is out-of-sync vs {LAB_SPEC}"


@pytest.mark.parametrize(
    "pkg,version",
    [
        [PY_SERVER_NAME, Version(PY_SERVER_VERSION).base_version],
        [JS_LSP_NAME, JS_LSP_VERSION],
        [JS_CJS_NAME, JS_CJS_VERSION],
    ],
)
def test_changelog_versions(pkg, version):
    """are the current versions represented in the changelog?"""
    assert f"## `{pkg} {version}`" in CHANGELOG.read_text(encoding="utf-8")


@pytest.mark.parametrize(
    "pkg,sep,version,expected",
    [
        [PY_SERVER_NAME, "=", PY_SERVER_VERSION, 1],  # TODO: update docker instructions
        [
            PY_SERVER_NAME,
            "==",
            PY_SERVER_VERSION,
            0,
        ],  # zero because jupyterlab-lsp is good enough
        [PY_SERVER_NAME + "-python", "=", PY_SERVER_VERSION, 1],
        [JS_LSP_NAME, "@", JS_LSP_VERSION, 1],  # TODO: update docker instructions
        [PY_FRONT_NAME, "=", JS_LSP_VERSION, 2],  # conda install
        [PY_FRONT_NAME, "==", JS_LSP_VERSION, 1],  # pip install
    ],
)
def test_installation_versions(the_installation_notebook, pkg, sep, version, expected):
    """are the first-party versions consistent with the package metadata?"""
    spec = f"{pkg}{sep}{version}"
    assert the_installation_notebook.count(spec) == expected, spec


@pytest.mark.parametrize(
    "pkg,count",
    [
        ["python", 2],
        # ["jupyterlab", 2], # this is handled through template variables
    ],
)
def test_installation_env_versions(
    the_installation_notebook, the_binder_env, pkg, count
):
    """are the third-party versions consistent with the binder?"""
    for spec in the_binder_env["dependencies"]:
        if isinstance(spec, str) and spec.startswith(f"{pkg} "):
            assert the_installation_notebook.count(spec) == count


@pytest.mark.parametrize("pkg", ["python", "jupyterlab", "nodejs"])
def test_contributing_versions(the_contributing_doc, the_binder_env, pkg):
    """are the documented contributing requirements consistent with binder?"""
    for spec in the_binder_env["dependencies"]:
        if isinstance(spec, str) and spec.startswith(f"{pkg} "):
            assert spec in the_contributing_doc


@pytest.mark.parametrize("path", [CI / "job.test.yml", REQS / "atest.yml", BINDER_ENV])
def test_robotframework_lsp_version(path):
    all_rflsp_version = re.findall(
        r"""(robotframework-lsp .*?)(?=\s*[$'#\n])""", path.read_text(encoding="utf-8")
    )

    assert set(all_rflsp_version) == {RFLSP}


@pytest.mark.parametrize(
    "pkg,requirement,version,has_specifier",
    [
        [PY_FRONT_PATH, "jupyter_lsp", PY_SERVER_VERSION, False],
        [PY_FRONT_PATH, "jupyterlab", LAB_SPEC, True],
        [PY_SERVER_PATH, "jupyter_server", REQUIRED_JUPYTER_SERVER, True],
    ],
)
def test_install_requires(pkg, requirement: str, version: str, has_specifier: bool):
    """are python packages requirements consistent with other versions?"""
    config = ConfigParser()
    config.read(pkg / "setup.cfg")
    requirements: Dict[str, Requirement] = {
        requirement.name: requirement
        for line in config["options"]["install_requires"].splitlines()
        if line.strip()
        for requirement in [Requirement(line)]
    }
    assert requirement in requirements
    parsed_specifier = str(requirements[requirement].specifier)
    raw_specifier = version if has_specifier else f">={version}"
    expected_specifier = str(SpecifierSet(raw_specifier))

    if has_specifier:
        assert expected_specifier == parsed_specifier
    else:
        assert Version(version) in requirements[requirement].specifier
        if expected_specifier != parsed_specifier:
            warn(
                f"Version matches, but specifier might need updating:"
                f" {requirement} {parsed_specifier}; version: {version}"
            )


def check_integrity():
    """actually run the tests"""
    args = ["-vv", __file__]

    try:
        if find_spec("pytest_azurepipelines"):
            args += ["--no-coverage-upload"]
    except ImportError:
        pass

    with tempfile.TemporaryDirectory() as tmp:
        ini = pathlib.Path(tmp) / "pytest.ini"
        ini.write_text(PYTEST_INI)

        args += ["-c", str(ini)]

        return pytest.main(args)


if __name__ == "__main__":
    sys.exit(check_integrity())
