#!/usr/bin/env python3
"""Bump version of selected packages or core requirements (JupyterLab)"""
import sys
from argparse import ArgumentParser
from dataclasses import dataclass
from difflib import context_diff
from pathlib import Path
from typing import List

from integrity import CHANGELOG
from integrity import PIPE_FILE as PIPELINE

ROOT = Path.cwd()

sys.path.insert(0, str(ROOT))

if True:
    # a workaround for isort 4.0 limitations
    # see https://github.com/timothycrosley/isort/issues/468
    from versions import JUPYTERLAB_LSP_VERSION  # noqa
    from versions import JUPYTER_LSP_VERSION, JUPYTERLAB_VERSION, REQUIRED_JUPYTERLAB


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
        changelog = CHANGELOG.read_text(encoding="utf-8")
        if new_version not in changelog:
            raise Exception(
                (
                    f"{new_version} is absent in CHANGELOG.md file."
                    f" Please update the changelog first."
                ).format(new_version=new_version)
            )

        for location in self.locations:
            replace_version(
                path=location.path,
                template=location.template,
                old=self.current_version,
                new=new_version,
                dry=dry,
            )


def replace_version(path: Path, template: str, old: str, new: str, dry: bool):
    old_content = path.read_text(encoding="utf-8")
    new_content = old_content.replace(
        template.format(version=old), template.format(version=new)
    )
    if dry:
        diff = context_diff(
            old_content.splitlines(),
            new_content.splitlines(),
            fromfile="current",
            tofile="new (proposed update)",
            n=4,
        )
        relative_path = path.relative_to(ROOT) if path.is_absolute() else path
        print("\n## Summary of changes proposed to {path}".format(path=relative_path))
        print("\n".join(diff) + "\n")
    else:
        path.write_text(new_content)


def update_versions(dry: bool):
    packages: List[PackageVersionInfo] = [
        PackageVersionInfo(
            name="jupyter-lsp (Python backend)",
            current_version=JUPYTER_LSP_VERSION,
            locations=[
                VersionLocation(
                    path=Path("python_packages/jupyter_lsp/jupyter_lsp/_version.py"),
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
                    path=JUPYTERLAB_LSP_PACKAGE,
                    template=NPM_PACKAGE_VERSION_TEMPLATE,
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
                VersionLocation(
                    path=README,
                    template="jupyterlab {version}",
                ),
                VersionLocation(
                    path=README,
                    template="JupyterLab {version}",
                ),
                VersionLocation(
                    path=Path("CONTRIBUTING.md"),
                    template="jupyterlab {version}",
                ),
                VersionLocation(
                    path=Path("docs/rtd.yml"),
                    template="jupyterlab {version}",
                ),
                VersionLocation(
                    path=Path("requirements/lab.txt"),
                    template="jupyterlab {version}",
                ),
                VersionLocation(
                    path=Path("python_packages/jupyterlab_lsp/setup.cfg"),
                    template="jupyterlab {version}",
                ),
                VersionLocation(
                    path=Path(".github/workflows/job.test.yml"),
                    template="lab: ['{version}']",
                ),
            ],
        ),
    ]
    for package in packages:
        package.maybe_change_version(dry=dry)


if __name__ == "__main__":
    parser = ArgumentParser()
    parser.add_argument(
        "--dry",
        action="store_true",
        help="do not perform the update, only show the changes",
    )
    args = parser.parse_args()
    update_versions(dry=args.dry)
