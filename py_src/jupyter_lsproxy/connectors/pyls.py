import shutil
from jupyter_lsp import LanguageServerApp, ConnectorCommands


def connect_pyls(app: LanguageServerApp) -> ConnectorCommands:
    """ connect jupyter-lsproxy to pyls for python, if available
    """
    if shutil.which("pyls"):
        return {"python": ["pyls"]}

    return {}
