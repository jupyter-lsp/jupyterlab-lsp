import shutil
from pathlib import Path
from typing import List, Text

from ..types import KeyedLanguageServerSpecs, LanguageServerManagerAPI

# helper scripts for known tricky language servers
HELPERS = Path(__file__).parent / "helpers"


class SpecBase:
    """ Base for a spec finder that returns a spec for starting a language server
    """

    key = ""
    languages = []  # type: List[Text]
    args = []  # type: List[Text]

    @classmethod
    def __call__(
        self, mgr: LanguageServerManagerAPI
    ) -> KeyedLanguageServerSpecs:  # pragma: no cover
        return {}


class ShellSpec(SpecBase):
    """ Helper for a language server spec for executables on $PATH in the
        notebook server environment.
    """

    cmd = ""

    def __call__(self, mgr: LanguageServerManagerAPI) -> KeyedLanguageServerSpecs:
        for ext in ["", ".cmd", ".bat", ".exe"]:
            cmd = shutil.which(self.cmd + ext)
            if cmd:
                break

        if not cmd:  # pragma: no cover
            return {}

        return {self.key: {"argv": [cmd, *self.args], "languages": self.languages}}


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
            }
        }
