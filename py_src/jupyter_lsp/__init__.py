# flake8: noqa: F401
from ._version import __version__
from .manager import LanguageServerManager, lsp_message_listener
from .specs.utils import NodeModuleSpec, ShellSpec
from .types import (
    KeyedLanguageServerSpecs,
    LanguageServerManagerAPI,
    LanguageServerSpec,
)


def _jupyter_server_extension_paths():
    return [{"module": "jupyter_lsp"}]
