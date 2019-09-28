# flake8: noqa: F401
from ._version import __version__
from .config import server_process_config
from .manager import ConnectorCommands, LanguageServerManager


def _jupyter_server_extension_paths():
    return [{"module": "jupyter_lsp.serverextension"}]
