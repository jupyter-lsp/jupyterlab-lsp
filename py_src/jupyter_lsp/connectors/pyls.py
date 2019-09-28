from jupyter_lsp.connectors.utils import ShellSpec


class PythonLanguageServer(ShellSpec):
    key = cmd = "pyls"
    languages = ["python"]
