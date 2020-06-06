""" A Jupyter Kernel wrapper for your language servers
"""
import json
import re
import uuid
from collections import OrderedDict
from pathlib import Path
from typing import Dict, List, Text

import traitlets
from ipykernel.ipkernel import IPythonKernel
from ipykernel.kernelapp import IPKernelApp

from .._version import __version__
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
    banner = "Jupyter Language Server Kernel ".format(__version__)  # type: Text
    help_links = [
        {
            "text": "Language Server Protocol",
            "url": "https://microsoft.github.io/language-server-protocol/",
        },
    ]

    language_server_manager = traitlets.Instance(CommLanguageServerManager)

    @traitlets.default("language_server_manager")
    def _default_language_server_manager(self):
        manager = CommLanguageServerManager(parent=self)
        return manager

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.log.error("Initializing Language Server Manager...")
        self.language_server_manager.initialize()


def launch():
    """ The main kernel entrypoint which uses the App singleton
    """
    IPKernelApp.launch_instance(kernel_class=LanguageServerKernel)


if __name__ == "__main__":
    launch()
