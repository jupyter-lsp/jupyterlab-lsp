""" API used by spec finders and manager
"""
import pathlib
import shutil
import sys
from typing import Callable, Dict, List, Text

from notebook.transutils import _
from traitlets import List as List_, Unicode, default
from traitlets.config import LoggingConfigurable

# TODO: TypedDict?
LanguageServerSpec = Dict[Text, List[Text]]
KeyedLanguageServerSpecs = Dict[Text, LanguageServerSpec]


class LanguageServerManagerAPI(LoggingConfigurable):
    """ Public API that can be used for python-based spec finders
    """

    nodejs = Unicode(help=_("path to nodejs executable")).tag(config=True)

    node_roots = List_([], help=_("absolute paths in which to seek node_modules")).tag(
        config=True
    )

    extra_node_roots = List_(
        [], help=_("additional absolute paths to seek node_modules first")
    ).tag(config=True)

    def find_node_module(self, *path_frag):
        """ look through the node_module roots to find the given node module
        """
        all_roots = self.extra_node_roots + self.node_roots
        found = None

        for candidate_root in all_roots:
            candidate = pathlib.Path(candidate_root, "node_modules", *path_frag)
            self.log.debug("Checking for %s", candidate)
            if candidate.exists():
                found = str(candidate)
                break

        if found is None:  # pragma: no cover
            self.log.debug(
                "%s not found in node_modules of %s", pathlib.Path(path_frag), all_roots
            )

        return found

    @default("nodejs")
    def _default_nodejs(self):
        return (
            shutil.which("node") or shutil.which("nodejs") or shutil.which("nodejs.exe")
        )

    @default("node_roots")
    def _default_node_roots(self):
        """ get the "usual suspects" for where `node_modules` may be found

        - where this was launch (usually the same as NotebookApp.notebook_dir)
        - the JupyterLab staging folder (if available)
        - wherever conda puts it
        - wherever some other conventions put it
        """

        # check where the server was started first
        roots = [pathlib.Path.cwd()]

        # try jupyterlab staging next
        try:
            from jupyterlab import commands

            roots += [pathlib.Path(commands.get_app_dir()) / "staging"]
        except ImportError:  # pragma: no cover
            pass

        # conda puts stuff in $PREFIX/lib on POSIX systems
        roots += [pathlib.Path(sys.prefix) / "lib"]

        # ... but right in %PREFIX% on nt
        roots += [pathlib.Path(sys.prefix)]

        return roots


# Gotta be down here so it can by typed... really should have a IL
SpecMaker = Callable[[LanguageServerManagerAPI], KeyedLanguageServerSpecs]
