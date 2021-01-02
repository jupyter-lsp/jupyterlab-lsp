import re
import sys
from pathlib import Path

import setuptools


LABEXTENSIONS_DIR = Path('py_src') / 'jupyter_lsp' / 'labextensions'
LABEXTENSIONS_INSTALL_DIR = Path('share') / 'jupyter' / 'labextensions'


def get_data_files():
    extension_files = [
        (str(LABEXTENSIONS_INSTALL_DIR / file.relative_to(LABEXTENSIONS_DIR).parent), [str(file)])
        for file in LABEXTENSIONS_DIR.rglob("*.*")
    ]

    extension_files.append(("etc/jupyter/jupyter_server_config.d", ["py_src/jupyter_lsp/etc/jupyter-lsp-serverextension.json"]))
    return extension_files


setuptools.setup(
    version=re.findall(
        r"""__version__ = "([^"]+)"$""",
        (Path(__file__).parent / "py_src" / "jupyter_lsp" / "_version.py").read_text(encoding="utf-8"),
    )[0],
    setup_requires=["pytest-runner"] if "test" in sys.argv else [],
    data_files=get_data_files()
)
