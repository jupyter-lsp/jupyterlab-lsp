from pathlib import Path

from setuptools import setup

LABEXTENSIONS_DIR = Path("klingon_ls_specification/labextensions")
LABEXTENSIONS_INSTALL_DIR = Path("share") / "jupyter" / "labextensions"
LAB_PACKAGE_PATH = (
    LABEXTENSIONS_DIR
    / "@krassowski"
    / "jupyterlab-lsp-klingon-integration"
    / "package.json"
)


def get_data_files():
    extension_files = [
        (
            str(LABEXTENSIONS_INSTALL_DIR / file.relative_to(LABEXTENSIONS_DIR).parent),
            [str(file.as_posix())],
        )
        for file in LABEXTENSIONS_DIR.rglob("*.*")
    ]

    return extension_files


setup(data_files=get_data_files())
