import re
import sys
from pathlib import Path

import setuptools

try:
    from pypandoc import convert_file

    def get_long_description(file_name):
        return convert_file(file_name, "rst", "md")

except ImportError:

    def get_long_description(file_name):
        with open(file_name) as f:
            return f.read()

setuptools.setup(
    version=re.findall(
        r"""__version__ = "([^"]+)"$""",
        (Path(__file__).parent / "py_src" / "jupyter_lsp" / "_version.py").read_text(),
    )[0],
    # long_description=get_long_description("py_src/jupyter_lsp/README.md"),
    long_description=get_long_description("README.md"),
    setup_requires=["pytest-runner"] if "test" in sys.argv else [],
    # py35 apparently doesn't support putting these in setup.cfg
    data_files=[
        (
            "etc/jupyter/jupyter_notebook_config.d",
            ["py_src/jupyter_lsp/etc/jupyter-lsp-serverextension.json"],
        )
    ],
)
