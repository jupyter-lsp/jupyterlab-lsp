from .utils import ShellSpec


class RLanguageServer(ShellSpec):
    key = cmd = "pyls"
    args = ["--slave", "-e", "languageserver::run()"]
    languages = ["R"]
