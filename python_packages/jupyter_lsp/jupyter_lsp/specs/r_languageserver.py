from subprocess import check_output

from .utils import ShellSpec


class RLanguageServer(ShellSpec):
    package = "languageserver"
    key = "r-languageserver"
    cmd = "Rscript"
    args = ["--slave", "-e", f"{package}::run()"]
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

    def is_installed(self, cmd) -> bool:
        if not super().is_installed(cmd):
            return False
        server_library_path = check_output(
            [cmd, "-e", f"cat(system.file(package='{self.package}'))"]
        ).decode(encoding="utf-8")
        return server_library_path != ""
