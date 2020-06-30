import os
import shutil
import sys
from pathlib import Path
from typing import List, Text

from ..schema import SPEC_VERSION
from ..types import (
    KeyedLanguageServerSpecs,
    LanguageServerManagerAPI,
    LanguageServerSpec,
)

# helper scripts for known tricky language servers
HELPERS = Path(__file__).parent / "helpers"

# when building docs, let all specs go through
BUILDING_DOCS = os.environ.get("JUPYTER_LSP_BUILDING_DOCS") is not None


class SpecBase:
    """ Base for a spec finder that returns a spec for starting a language server
    """

    key = ""
    languages = []  # type: List[Text]
    args = []  # type: List[Text]
    spec = {}  # type: LanguageServerSpec

    def __call__(
        self, mgr: LanguageServerManagerAPI
    ) -> KeyedLanguageServerSpecs:  # pragma: no cover
        return {}


class ShellSpec(SpecBase):  # pragma: no cover
    """ Helper for a language server spec for executables on $PATH in the
        notebook server environment.
    """

    cmd = ""

    def __call__(self, mgr: LanguageServerManagerAPI) -> KeyedLanguageServerSpecs:
        for ext in ["", ".cmd", ".bat", ".exe"]:
            cmd = shutil.which(self.cmd + ext)
            if cmd:
                break

        if not cmd and BUILDING_DOCS:  # pragma: no cover
            cmd = self.cmd

        if not cmd:  # pragma: no cover
            return {}

        return {
            self.key: {
                "argv": [cmd, *self.args],
                "languages": self.languages,
                "version": SPEC_VERSION,
                **self.spec,
            }
        }


class PythonModuleSpec(SpecBase):
    """ Helper for a python-based language server spec in the notebook server
        environment
    """

    python_module = ""

    def __call__(self, mgr: LanguageServerManagerAPI) -> KeyedLanguageServerSpecs:
        spec = __import__("importlib").util.find_spec(self.python_module)

        if not spec.origin:  # pragma: no cover
            return {}

        return {
            self.key: {
                "argv": [sys.executable, "-m", self.python_module, *self.args],
                "languages": self.languages,
                "version": SPEC_VERSION,
                **self.spec,
            }
        }


class NodeModuleSpec(SpecBase):
    """ Helper for a nodejs-based language server spec in one of several
        node_modules
    """

    node_module = ""
    script = []  # type: List[Text]

    def __call__(self, mgr: LanguageServerManagerAPI) -> KeyedLanguageServerSpecs:
        node_module = mgr.find_node_module(self.node_module, *self.script)

        if not node_module:  # pragma: no cover
            return {}

        return {
            self.key: {
                "argv": [mgr.nodejs, node_module, *self.args],
                "languages": self.languages,
                "version": SPEC_VERSION,
                **self.spec,
            }
        }
