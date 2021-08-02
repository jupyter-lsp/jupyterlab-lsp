import json
import re
from pathlib import Path

import setuptools

LABEXTENSIONS_DIR = Path("jupyterlab_lsp/labextensions")
LABEXTENSIONS_INSTALL_DIR = Path("share") / "jupyter" / "labextensions"
LAB_PACKAGE_PATH = LABEXTENSIONS_DIR / "@krassowski" / "jupyterlab-lsp" / "package.json"


def get_data_files():
    extension_files = [
        (
            str(LABEXTENSIONS_INSTALL_DIR / file.relative_to(LABEXTENSIONS_DIR).parent),
            [str(file.as_posix())],
        )
        for file in LABEXTENSIONS_DIR.rglob("*.*")
    ]

    extension_files.append(
        (
            str(LABEXTENSIONS_INSTALL_DIR / "@krassowski" / "jupyterlab-lsp"),
            ["jupyterlab_lsp/install.json"],
        )
    )

    return extension_files


_version = json.loads(LAB_PACKAGE_PATH.read_text(encoding="utf-8"))["version"]
_release = re.findall(
    r"""__release__ = "([^"]*)"$""",
    (Path(__file__).parent / "jupyterlab_lsp" / "_version.py").read_text(
        encoding="utf-8"
    ),
    flags=re.MULTILINE,
)[0]

setuptools.setup(
    version=f"{_version}{_release}",
    data_files=get_data_files(),
    # explicit name as a workaround for GitHub dependency analyzer
    # not discovering Python packages otherwise
    name="jupyterlab-lsp",
)
