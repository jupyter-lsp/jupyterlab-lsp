# flake8: noqa: F401
from ._version import __version__
from .connectors.utils import NodeModuleSpec, ShellSpec
from .manager import LanguageServerManager
from .types import (
    KeyedLanguageServerSpecs,
    LanguageServerManagerAPI,
    LanguageServerSpec,
)


def _jupyter_server_extension_paths():
    return [{"module": "jupyter_lsp.serverextension"}]
