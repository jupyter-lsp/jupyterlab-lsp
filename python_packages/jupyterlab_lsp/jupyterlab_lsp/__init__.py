# flake8: noqa: F401
from ._version import __version__


def _jupyter_labextension_paths():
    return [
        {
            "src": "labextensions/@jupyter-lsp/jupyterlab-lsp",
            "dest": "@jupyter-lsp/jupyterlab-lsp",
        }
    ]
