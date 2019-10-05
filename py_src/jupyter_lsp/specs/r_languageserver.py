from .utils import HELPERS, ShellSpec


class RLanguageServer(ShellSpec):
    key = "r-languageserver"
    cmd = "Rscript"
    args = ["--slave", str(HELPERS / "languageserver.R")]
    languages = ["r"]
