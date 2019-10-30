from .utils import ShellSpec


class PythonLanguageServer(ShellSpec):
    key = cmd = "pyls"
    languages = ["python"]
