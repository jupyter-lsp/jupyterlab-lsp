from .utils import ShellSpec


class RLanguageServer(ShellSpec):
    package = "languageserver"
    key = "r-languageserver"
    cmd = "Rscript"

    @property
    def args(self):
        return ["--slave", "-e", f"{self.package}::run()"]

    @property
    def is_installed_args(self):
        return ["-e", f"cat(system.file(package='{self.package}'))"]

    languages = ["r"]
    spec = dict(
        display_name=key,
        mime_types=["text/x-rsrc"],
        urls=dict(
            home="https://github.com/REditorSupport/languageserver",
            issues="https://github.com/REditorSupport/languageserver/issues",
        ),
        install=dict(
            cran=f'install.packages("{package}")',
            conda="conda install -c conda-forge r-languageserver",
        ),
    )
