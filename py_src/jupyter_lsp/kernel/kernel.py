""" A Jupyter Kernel wrapper for your language servers
"""
import json
import logging
import os
from pathlib import Path
from typing import Dict, Text

import traitlets
from ipykernel.ipkernel import IPythonKernel
from ipykernel.kernelapp import IPKernelApp

from .._version import __version__
from ..paths import normalized_uri
from ..virtual_documents_shadow import setup_shadow_filesystem
from .manager import CommLanguageServerManager

__all__ = ["LanguageServerKernel"]

HERE = Path(__file__).parent.resolve()
KERNEL_JSON = json.loads(
    (HERE / "resources" / "kernel.json").read_text(encoding="utf-8")
)
LANGUAGE_INFO = {
    **{k: v for k, v in KERNEL_JSON.items() if k not in ["argv"]},
    "version": __version__,
    "file_extension": ".py",
}


class LanguageServerKernel(IPythonKernel):
    """ A Jupyter Kernel for the Language Server Protocol
    """

    implementation = "jupyter-lsp-kernel"  # type: Text
    implementation_version = __version__  # type: Text
    language = LANGUAGE_INFO["language"]  # type: Text
    language_version = LANGUAGE_INFO["version"]  # type: Text
    language_info = LANGUAGE_INFO  # type: Dict
    banner = "Jupyter Language Server Kernel {}".format(__version__)  # type: Text
    help_links = [
        {
            "text": "Language Server Protocol",
            "url": "https://microsoft.github.io/language-server-protocol/",
        },
        {
            "text": "Jupyter LSP Documentation",
            "url": "https://jupyterlab-lsp.readthedocs.io",
        },
    ]

    language_server_manager = traitlets.Instance(CommLanguageServerManager)

    @traitlets.default("language_server_manager")
    def _default_language_server_manager(self):
        manager = CommLanguageServerManager(parent=self)
        return manager

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.log is None:
            self.log = logging.getLogger(__name__)
        self.log.info("Initializing Language Server Manager...")
        self.language_server_manager.initialize()

        root_uri = normalized_uri(os.getcwd())
        virtual_documents_uri = root_uri + "/.virtual_documents"
        setup_shadow_filesystem(virtual_documents_uri=virtual_documents_uri)


def launch():  # pragma: no cover
    """ The main kernel entrypoint which uses the App singleton
    """
    IPKernelApp.launch_instance(kernel_class=LanguageServerKernel)


if __name__ == "__main__":  # pragma: no cover
    launch()
