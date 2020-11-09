import re
import sys
from pathlib import Path

import setuptools

from jupyter_packaging import create_cmdclass


data_files_spec = [
    ('share/jupyter/labextensions', 'py_src/jupyter_lsp/labextensions', '**'),
    ('etc/jupyter/jupyter_notebook_config.d', 'py_src/jupyter_lsp/etc', 'jupyter-lsp-serverextension.json')
]


setuptools.setup(
    version=re.findall(
        r"""__version__ = "([^"]+)"$""",
        (Path(__file__).parent / "py_src" / "jupyter_lsp" / "_version.py").read_text(),
    )[0],
    setup_requires=["pytest-runner"] if "test" in sys.argv else [],
    cmd_class=create_cmdclass(data_files_spec=data_files_spec),
)
