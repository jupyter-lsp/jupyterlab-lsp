import shutil
from typing import List, Text

from ..types import KeyedLanguageServerSpecs, LanguageServerManagerAPI


class SpecBase:
    """ Base for a connector that returns a spec for starting a language server
    """

    key = ""
    languages = []  # type: List[Text]
    args = []  # type: List[Text]

    @classmethod
    def __call__(cls, mgr: LanguageServerManagerAPI) -> KeyedLanguageServerSpecs:
        return {}


class ShellSpec(SpecBase):
    """ Helper for a language server spec for executables on $PATH in the
        notebook server environment.
    """

    cmd = ""

    @classmethod
    def __call__(cls, mgr: LanguageServerManagerAPI) -> KeyedLanguageServerSpecs:
        for ext in ["", ".cmd", ".bat", ".exe"]:
            cmd = shutil.which(cls.cmd + ext)
            if cmd:
                break

        if not cmd:
            return {}

        return {cls.key: {"argv": [cmd, *cls.args], "languages": cls.languages}}


class NodeModuleSpec:
    """ Helper for a nodejs-based language server spec in one of several
        node_modules
    """

    node_module = ""
    script = []  # type: List[Text]

    @classmethod
    def __call__(cls, mgr: LanguageServerManagerAPI) -> KeyedLanguageServerSpecs:
        node_module = mgr.find_node_module(cls.node_module, *cls.script)

        if not node_module:
            return {}

        return {
            cls.key: {
                "argv": [mgr.nodejs, node_module, *cls.args],
                "languages": cls.languages,
            }
        }
