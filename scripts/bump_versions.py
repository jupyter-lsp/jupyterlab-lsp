#!/usr/bin/env python3
"""Bump version of selected packages or core requirements (JupyterLab)"""
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import List

from integrity import CHANGELOG, PIPE_FILE as PIPELINE

ROOT = Path.cwd()

sys.path.insert(0, str(ROOT))

if True:
    # a workaround for isort 4.0 limitations
    # see https://github.com/timothycrosley/isort/issues/468
    from versions import (  # noqa
        JUPYTER_LSP_VERSION,
        JUPYTERLAB_LSP_VERSION,
        JUPYTERLAB_VERSION,
        REQUIRED_JUPYTERLAB,
    )


META_PACKAGE = Path("packages/metapackage/package.json")
JUPYTERLAB_LSP_PACKAGE = Path("packages/jupyterlab-lsp/package.json")
README = Path("README.md")

NPM_PACKAGE_VERSION_TEMPLATE = '"version": "{version}"'


@dataclass
class VersionLocation:
    path: Path
    template: str


@dataclass
class PackageVersionInfo:
    name: str
    current_version: str
    locations: List[VersionLocation]

    def maybe_change_version(self, dry: bool):
        print(f"Current {self.name} version is: {self.current_version}")
        version = input("Change it to [default=skip]: ").strip()
        if version:
            self.change_version(new_version=version, dry=dry)

    def change_version(self, new_version: str, dry: bool):

        changelog = CHANGELOG.read_text()
        assert new_version in changelog

        for location in self.locations:
            replace_version(
                path=location.path,
                template=location.template,
                old=self.current_version,
                new=new_version,
                dry=dry,
            )


def replace_version(path: Path, template: str, old: str, new: str, dry: bool):
    new_content = path.read_text().replace(
        template.format(version=old), template.format(version=new)
    )
    if dry:
        print(path)
        print(new_content)
    else:
        path.write_text(new_content)


def update_versions(dry: bool):
    packages: List[PackageVersionInfo] = [
        PackageVersionInfo(
            name="jupyter-lsp (Python backend)",
            current_version=JUPYTER_LSP_VERSION,
            locations=[
                VersionLocation(
                    path=Path("py_src/jupyter_lsp/_version.py"),
                    template='__version__ = "{version}"',
                ),
                VersionLocation(path=PIPELINE, template="PY_JLSP_VERSION: {version}"),
            ],
        ),
        PackageVersionInfo(
            name="jupyterlab-lsp (frontend package)",
            current_version=JUPYTERLAB_LSP_VERSION,
            locations=[
                VersionLocation(
                    path=JUPYTERLAB_LSP_PACKAGE, template=NPM_PACKAGE_VERSION_TEMPLATE,
                ),
                VersionLocation(path=PIPELINE, template="JS_JLLSP_VERSION: {version}"),
                VersionLocation(
                    path=META_PACKAGE, template=NPM_PACKAGE_VERSION_TEMPLATE
                ),
            ],
        ),
        PackageVersionInfo(
            name="JupyterLab - exact",
            current_version=JUPYTERLAB_VERSION,
            locations=[
                VersionLocation(
                    path=JUPYTERLAB_LSP_PACKAGE,
                    template='"@jupyterlab/application": "~{version}"',
                )
            ],
        ),
        PackageVersionInfo(
            name="JupyterLab - range",
            current_version=REQUIRED_JUPYTERLAB,
            locations=[
                VersionLocation(
                    path=Path("binder/environment.yml"),
                    template="jupyterlab {version}",
                ),
                VersionLocation(path=README, template="jupyterlab {version}",),
                VersionLocation(path=README, template="JupyterLab {version}",),
            ],
        ),
    ]
    for package in packages:
        package.maybe_change_version(dry=dry)


if __name__ == "__main__":
    update_versions(dry=False)
