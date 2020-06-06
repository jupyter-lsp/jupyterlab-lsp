import sys

from traitlets import Bool
from traitlets.config import Application


class LSPKernelSpecInstallApp(Application):
    description = """Install the kernelspec"""

    sys_prefix = Bool(
        default_value=True, help="Install into the current environment", config=True
    )

    def start(self):
        from .kernel.install import install

        dest = install(prefix=sys.prefix)
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

if __name__ == "__main__":
    main()
