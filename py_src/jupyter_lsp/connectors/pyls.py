import shutil

from jupyter_lsp import ConnectorCommands, LanguageServerManager


def connect_pyls(mgr: LanguageServerManager) -> ConnectorCommands:
    """ connect jupyter-lsproxy to pyls for python, if available
    """
    if shutil.which("pyls"):
        return [{"languages": ["python"], "args": ["pyls"]}]

    return []
