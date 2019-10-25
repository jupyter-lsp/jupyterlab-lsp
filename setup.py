import re
import sys
from pathlib import Path

import setuptools

setuptools.setup(
    version=re.findall(
        r"""__version__ = "([^"]+)"$""",
        (Path(__file__).parent / "py_src" / "jupyter_lsp" / "_version.py").read_text(),
    )[0],
    setup_requires=["pytest-runner"] if "test" in sys.argv else [],
    # py35 apparently doesn't support putting these in setup.cfg
    data_files=[
        (
            "etc/jupyter/jupyter_notebook_config.d",
            ["py_src/jupyter_lsp/etc/jupyter-lsp-serverextension.json"],
        )
    ],
)
