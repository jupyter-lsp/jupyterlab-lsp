import json
import sys
from pathlib import Path

import setuptools

LABEXTENSIONS_DIR = Path("labextensions")
LABEXTENSIONS_INSTALL_DIR = Path("share") / "jupyter" / "labextensions"
LAB_PACKAGE_PATH = LABEXTENSIONS_DIR / "@krassowski" / "jupyterlab-lsp" / "package.json"


def get_data_files():
    extension_files = [
        (
            str(LABEXTENSIONS_INSTALL_DIR / file.relative_to(LABEXTENSIONS_DIR).parent),
            [str(file)],
        )
        for file in LABEXTENSIONS_DIR.rglob("*.*")
    ]

    extension_files.append(
        (
            str(LABEXTENSIONS_INSTALL_DIR / "@krassowski" / "jupyterlab-lsp"),
            ["install.json"],
        )
    )
    return extension_files


setuptools.setup(
    version=json.loads(LAB_PACKAGE_PATH.read_text(encoding="utf-8"))["version"],
    setup_requires=["pytest-runner"] if "test" in sys.argv else [],
    data_files=get_data_files(),
)
