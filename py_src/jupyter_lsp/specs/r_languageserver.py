from .utils import HELPERS, ShellSpec


class RLanguageServer(ShellSpec):
    key = "r-languageserver"
    cmd = "Rscript"
    args = ["--slave", (HELPERS / "languageserver.R")]
    languages = ["r"]
