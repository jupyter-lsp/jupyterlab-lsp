""" check internal version consistency

    these should be quick to run (not invoke any other process)
"""
import json
import pathlib
import re
import sys
import tempfile

import jsonschema
import pytest

try:
    import ruamel.yaml as yaml
except ImportError:
    import ruamel_yaml as yaml

ROOT = pathlib.Path.cwd()

# docs
MAIN_README = ROOT / "README.md"

# dependencies
ENV = yaml.safe_load((ROOT / "environment.yml").read_text())
LAB_SPEC = [
    d.split(" ", 1)[1]
    for d in ENV["dependencies"]
    if isinstance(d, str) and d.startswith("jupyterlab ")
][0]

# TS stuff
NPM_NS = "@krassowski"
PACKAGES = {
    package["name"]: [path.parent, package]
    for path, package in [
        (path, json.loads(path.read_text()))
        for path in ROOT.glob("packages/*/package.json")
    ]
}
MAIN_NAME = "{}/jupyterlab-lsp".format(NPM_NS)
META_NAME = "{}/jupyterlab-lsp-metapackage".format(NPM_NS)

MAIN_EXT_VERSION = PACKAGES[MAIN_NAME][1]["version"]

# py stuff
_VERSION_PY = ROOT / "py_src" / "jupyter_lsp" / "_version.py"
PY_VERSION = re.findall(r'= "(.*)"$', (_VERSION_PY).read_text())[0]

# CI stuff
PIPE_FILE = ROOT / "azure-pipelines.yml"
PIPELINES = yaml.safe_load(PIPE_FILE.read_text())
PIPE_VARS = PIPELINES["variables"]


@pytest.fixture(scope="module")
def the_meta_package():
    meta_path, meta = PACKAGES[META_NAME]
    return (
        meta_path,
        meta,
        json.loads((meta_path / "tsconfig.json").read_text()),
        (meta_path / "src" / "index.ts").read_text(),
    )


@pytest.mark.parametrize(
    "name,version",
    [["PY_JLSP_VERSION", PY_VERSION], ["JS_JLLSP_VERSION", MAIN_EXT_VERSION]],
)
def test_ci_variables(name, version):
    assert PIPE_VARS[name] == version


@pytest.mark.parametrize(
    "name,info", [p for p in PACKAGES.items() if p[0] != META_NAME]
)
def test_ts_package_integrity(name, info, the_meta_package):
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


def test_ts_readme():
    version = PACKAGES[MAIN_NAME][1]["version"]
    assert (
        "{}@{}".format(MAIN_NAME, version) in MAIN_README.read_text()
    ), "README.md is out of sync vs {}".format(version)


@pytest.mark.parametrize(
    "path",
    map(
        str,
        [ROOT / "requirements-lab.txt", ROOT / "ci" / "env-test.yml.in", MAIN_README],
    ),
)
def test_jlab_versions(path):
    assert (
        "jupyterlab {}".format(LAB_SPEC) in pathlib.Path(path).read_text().lower()
    ), "{} lab version is out-of-sync vs {}".format(path, LAB_SPEC)


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as td:
        ini = pathlib.Path(td) / "pytest.ini"
        ini.write_text("")

        sys.exit(pytest.main(["-c", str(ini), "-vv", __file__]))
