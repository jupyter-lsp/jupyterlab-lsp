from .utils import HELPERS, ShellSpec


class RLanguageServer(ShellSpec):
    key = "r-languageserver"
    cmd = "Rscript"
    args = ["--slave", str(HELPERS / "languageserver.R")]
    languages = ["r"]
    spec = dict(
        display_name=key,
        mime_types=["text/x-rsrc"],
        urls=dict(
            home="https://github.com/REditorSupport/languageserver",
            issues="https://github.com/REditorSupport/languageserver/issues",
        ),
        install=dict(
            cran='install.packages("languageserver")',
            conda="conda install -c conda-forge r-languageserver",
        ),
    )
