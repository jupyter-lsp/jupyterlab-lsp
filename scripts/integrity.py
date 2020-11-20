""" check internal version consistency

    these should be quick to run (not invoke any other process)
"""
# pylint: disable=redefined-outer-name,unused-variable

import json
import pathlib
import sys
import tempfile
from importlib.util import find_spec

import jsonschema
import nbformat
import pytest
from nbconvert.preprocessors import ExecutePreprocessor

try:
    import ruamel.yaml as yaml
except ImportError:
    import ruamel_yaml as yaml

ROOT = pathlib.Path.cwd()

sys.path.insert(0, str(ROOT))

if True:
    # a workaround for isort 4.0 limitations
    # see https://github.com/timothycrosley/isort/issues/468
    from versions import (  # noqa
        REQUIRED_JUPYTERLAB as LAB_SPEC,
        JUPYTER_LSP_VERSION as PY_VERSION,
    )

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
        (path, json.loads(path.read_text()))
        for path in ROOT.glob("packages/*/package.json")
    ]
}

META_NAME = "{}/jupyterlab-lsp-metapackage".format(NPM_NS)

JS_LSP_NAME = "{}/jupyterlab-lsp".format(NPM_NS)
JS_LSP_VERSION = PACKAGES[JS_LSP_NAME][1]["version"]

JS_G2D_NAME = "{}/jupyterlab_go_to_definition".format(NPM_NS)
JS_G2D_VERSION = PACKAGES[JS_G2D_NAME][1]["version"]

# py stuff
PY_NAME = "jupyter-lsp"


# CI stuff
PIPE_FILE = ROOT / ".github/workflows/job.test.yml"
PIPELINES = yaml.safe_load(PIPE_FILE.read_text())
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
        json.loads((meta_path / "tsconfig.json").read_text()),
        (meta_path / "src" / "index.ts").read_text(),
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
    "name,version",
    [
        ["PY_JLSP_VERSION", PY_VERSION],
        ["JS_JLLSP_VERSION", JS_LSP_VERSION],
        ["JS_JLG2D_VERSION", JS_G2D_VERSION],
    ],
)
def test_ci_variables(name, version):
    """Are the CI version variables consistent?"""
    assert PIPE_VARS[name] == version


@pytest.mark.parametrize(
    "name,info", [p for p in PACKAGES.items() if p[0] != META_NAME]
)
def test_ts_package_integrity(name, info, the_meta_package):
    """are the versions of the frontend packages consistent and in the metapackage?"""
    m_path, m_pkg, m_tsconfig, m_index = the_meta_package
    path, pkg = info

    assert (
        name in m_pkg["dependencies"]
    ), "{} missing from metapackage/package.json".format(name)

    assert (
        "'{}'".format(name) in m_index
    ), "{} missing from metapackage/src/index.ts".format(name)

    assert [
        ref
        for ref in m_tsconfig["references"]
        if ref["path"] == "../{}".format(path.name)
    ], "{} missing from metapackage/tsconfig.json".format(name)

    schemas = list(path.glob("schema/*.json"))

    if schemas:
        for schema in schemas:
            schema_instance = json.loads(schema.read_text())
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
        ],
    ),
)
def test_jlab_versions(path):
    """is the version of jupyterlab consistent?"""
    assert (
        LAB_SPEC in pathlib.Path(path).read_text().lower()
    ), "{} lab version is out-of-sync vs {}".format(path, LAB_SPEC)


@pytest.mark.parametrize(
    "pkg,version",
    [
        [PY_NAME, PY_VERSION],
        [JS_LSP_NAME, JS_LSP_VERSION],
        [JS_G2D_NAME, JS_G2D_VERSION],
    ],
)
def test_changelog_versions(pkg, version):
    """are the current versions represented in the changelog?"""
    assert "## `{} {}`".format(pkg, version) in CHANGELOG.read_text()


@pytest.mark.parametrize(
    "pkg,sep,version,expected",
    [
        [PY_NAME, "=", PY_VERSION, 2],
        [PY_NAME, "==", PY_VERSION, 1],
        [PY_NAME + "-python", "=", PY_VERSION, 1],
        [JS_LSP_NAME, "@", JS_LSP_VERSION, 4],
    ],
)
def test_installation_versions(the_installation_notebook, pkg, sep, version, expected):
    """are the first-party versions consistent with the package metadata?"""
    assert the_installation_notebook.count(f"{pkg}{sep}{version}") == expected


@pytest.mark.parametrize(
    "pkg,count",
    [
        ["python", 2],
        ["nodejs", 4],
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
