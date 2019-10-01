from .utils import ShellSpec


class RLanguageServer(ShellSpec):
    key = cmd = "R"
    args = ["--slave", "-e", "languageserver::run()"]
    languages = ["R"]
