from jupyter_lsp.specs.utils import ShellSpec


class PythonLanguageServer(ShellSpec):
    key = cmd = "pyls"
    languages = ["python"]
