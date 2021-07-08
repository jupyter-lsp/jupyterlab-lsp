from jupyter_lsp.specs.utils import ShellSpec


class KlingonServerSpecification(ShellSpec):
    """Dummy specs for testing the behaviour with non-installed servers."""

    # This one (obviously) does not exist; for a real server,
    # just use the name of the command to run; please note
    # that there are other convenience classes such as
    # `PythonModuleSpec` or `NodeModuleSpec`.
    cmd = "run-klingon-language-server"

    # Language will be matched against the programming language of file which
    # gets inferred from MIME type (and MIME type gets inferred from the file
    # extension, using the file type registered with `DocumentRegistry` in
    # `packages/_klingon-integration/src/index.ts`). Note that in general case
    # there registering the file type may not be needed (because the MIME type
    # for many languages can be inferred from the code highlighting modes, or
    # can be retrieved directly from kernel response in notebooks).
    languages = ["klingon"]

    spec = {
        "troubleshoot": "This is just a test language server.",
        "urls": {"Wikipedia": "https://en.wikipedia.org/wiki/Klingon_language"},
        "install": {"pip": 'echo "This language server cannot be installed."'},
    }

    def is_installed(self, manager) -> bool:
        # For a real server do not override this method,
        # but instead use `is_installed_args` (if possible).
        return False


# Note: in a real world use, you could just create a function that accepts one
# argument (of `LanguageServerManager` type) and returns a nested dict
# following our schema, but using an object of class inheriting from `SpecBase`
# (note: `ShellSpec` inherits from `SpecBase`) allows for adding methods such
# as `is_installed()` easily.
SPECS = KlingonServerSpecification()
