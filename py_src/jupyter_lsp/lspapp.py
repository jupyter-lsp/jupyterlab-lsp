import sys
from typing import Any

from traitlets import Bool, Unicode
from traitlets.config import Application


class LSPKernelSpecInstallApp(Application):
    description = """Install the kernelspec"""

    prefix = Unicode(
        default_value=None,
        help="Install into given path prefix",
        config=True,
        allow_none=True,
    )

    sys_prefix = Bool(
        default_value=True, help="Install into the current environment", config=True,
    )

    display_name = Unicode(
        default_value=None, help="Custom display name", config=True, allow_none=True
    )

    kernel_name = Unicode(
        default_value=None,
        help="Custom kernel name (e.g. kernel resource path)",
        config=True,
        allow_none=True,
    )

    def start(self):
        from .kernel.install import install

        kwargs = {}  # type: Any

        if self.prefix:
            kwargs["prefix"] = self.prefix
        elif self.sys_prefix:  # pragma: no covers
            kwargs["prefix"] = sys.prefix

        if self.display_name:
            kwargs["display_name"] = self.display_name

        if self.kernel_name:
            kwargs["kernel_name"] = self.kernel_name

        dest = install(**kwargs)

        print("installed kernelspec to", dest)


class LSPKernelSpecApp(Application):
    description = """Work with the Language Server Kernel"""
    subcommands = dict(
        install=(
            LSPKernelSpecInstallApp,
            LSPKernelSpecInstallApp.description.splitlines()[0],
        ),
    )


class LSPApp(Application):
    """Dummy app wrapping argparse"""

    name = "jupyter-lsp"
    subcommands = dict(
        kernelspec=(LSPKernelSpecApp, LSPKernelSpecApp.description.splitlines()[0]),
    )


main = launch_instance = LSPApp.launch_instance

if __name__ == "__main__":  # pragma: no cover
    main()
