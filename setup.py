from os import chdir
import re
import sys
from pathlib import Path
from glob import iglob

import setuptools


LABEXTENSIONS_DIR = Path('py_src') / 'jupyter_lsp' / 'labextensions'
LABEXTENSIONS_INSTALL_DIR = Path('share') / 'jupyter' / 'labextensions'



def get_data_files():
    chdir(str(LABEXTENSIONS_DIR))

    extension_files = [
        (str(LABEXTENSIONS_INSTALL_DIR / Path(filename).parent), [str(LABEXTENSIONS_DIR / filename)])
        for filename in iglob('**/*.*', recursive=True)
    ]

    chdir('../../../')

    extension_files.append(("etc/jupyter/jupyter_notebook_config.d", ["py_src/jupyter_lsp/etc/jupyter-lsp-serverextension.json"]))

    return extension_files


setuptools.setup(
    version=re.findall(
        r"""__version__ = "([^"]+)"$""",
        (Path(__file__).parent / "py_src" / "jupyter_lsp" / "_version.py").read_text(),
    )[0],
    setup_requires=["pytest-runner"] if "test" in sys.argv else [],
    data_files=get_data_files(),
)
