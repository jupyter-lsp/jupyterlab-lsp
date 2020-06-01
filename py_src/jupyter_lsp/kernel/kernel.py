""" A Jupyter Kernel wrapper for your language servers
"""
import json
import re
import uuid
from collections import OrderedDict
from pathlib import Path
from typing import Dict, List, Text

from ipykernel.ipkernel import IPythonKernel
from ipykernel.kernelapp import IPKernelApp
from ipykernel.comm import Comm

from .._version import __version__

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

CONTROL_COMM_TARGET = "jupyter.lsp.control"
SERVER_COMM_TARGET = "jupyter.lsp.server"

from ..manager import LanguageServerManager


class CommHandler:
    """ imitates the websocket handler
    """

    comm = None
    subscribed = None

    def __init__(self, language_server, comm, manager):
        self.language_server = language_server
        self.comm = comm
        self.manager = manager
        self.subscribed = False
        comm.on_msg(self.on_message)

    @property
    def log(self):
        return self.manager.log

    async def on_message(self, message):
        self.log.debug("[{}] Handling a message".format(self.language_server))
        if not self.subscribed:
            self.manager.subscribe(self)
            self.subscribed = True
        await self.manager.on_client_message(message, self)

    def write_message(self, message: str):
        self.comm.send(json.loads(message))


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
        {"text": "Language Server Protocol", "url": "https://microsoft.github.io/language-server-protocol/"},
    ]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._lsp_comms = {}
        self.init_lsp_comm()
        self.init_lsp_manager()

    def init_lsp_manager(self):
        self.lsp_manager = LanguageServerManager(parent=self)
        self.lsp_manager.initialize()

    def init_lsp_comm(self):
        self.comm_manager.register_target(CONTROL_COMM_TARGET, self.on_lsp_comm_opened)
        self.log.error('comm target registered')

    def on_lsp_comm_opened(self, comm, comm_msg):
        self.log.error('comm received %s: %s', comm, comm_msg)
        self.init_server_comms()

    def init_server_comms(self):
        for language_server, session in self.lsp_manager.sessions.items():
            self.make_server_comm(language_server, session)

    def make_server_comm(self, language_server, session):
        self.log.error("comm for %s", language_server)
        comm = Comm(
            target_name=SERVER_COMM_TARGET,
            metadata={
                "language_server": language_server,
                "session": session.to_json()
            },
        )
        self._lsp_comms[language_server] = CommHandler(
            language_server=language_server,
            comm=comm,
            manager=self.lsp_manager
        )


def launch():
    """ The main kernel entrypoint which uses the App singleton
    """
    IPKernelApp.launch_instance(kernel_class=LanguageServerKernel)



if __name__ == "__main__":
    launch()
