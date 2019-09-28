""" A configurable frontend for `python-jsonrpc-server`
"""
import os
import pathlib
import shutil
import sys
from typing import Callable, Dict, List, Text

import pkg_resources
from jupyterlab.commands import get_app_dir
from notebook.transutils import _
from traitlets import Bool, Dict as Dict_, Instance, List as List_, Unicode, default
from traitlets.config import LoggingConfigurable

from .constants import EP_CONNECTOR_V0
from .session import LanguageServerSession

# todo: typeddict?
ConnectorCommands = List[Dict[Text, List[Text]]]


class LanguageServerManager(LoggingConfigurable):
    """ Manage language servers
    """

    language_servers = List_(
        trait=Dict_, default_value=[], help=_("a lists of specs of languages and args")
    ).tag(config=True)

    nodejs = Unicode(help=_("path to nodejs executable")).tag(config=True)

    autodetect = Bool(
        True, help=_("try to find known language servers in sys.prefix (and elsewhere)")
    ).tag(config=True)

    node_roots = List_([], help=_("absolute paths in which to seek node_modules")).tag(
        config=True
    )

    extra_node_roots = List_(
        [], help=_("additional absolute paths to seek node_modules first")
    ).tag(config=True)

    sessions = Dict_(
        trait=Instance(LanguageServerSession),
        default_value={},
        help="sessions keyed by languages served",
    )

    @default("nodejs")
    def _default_nodejs(self):
        return (
            shutil.which("node") or shutil.which("nodejs") or shutil.which("nodejs.exe")
        )

    @default("node_roots")
    def _default_node_roots(self):
        """ get the "usual suspects" for where node_modules may be found

        - where this was launch (usually the same as NotebookApp.notebook_dir)
        - the JupyterLab staging folder
        - wherever conda puts it
        - wherever some other conventions put it
        """
        return [
            os.getcwd(),
            pathlib.Path(get_app_dir()) / "staging",
            pathlib.Path(sys.prefix) / "lib",
            # TODO: "well-known" windows paths
            sys.prefix,
        ]

    def __init__(self, **kwargs):
        """ Before starting, perform all necessary configuration
        """
        super().__init__(**kwargs)
        self.init_language_servers()

    def init_language_servers(self):
        """ determine the final language server configuration.
        """
        language_servers = []  # type: ConnectorCommands

        # copy the language servers before anybody monkeys with them
        language_servers_from_config = self.language_servers[:]

        langs = {
            tuple(sorted(spec["languages"])) for spec in language_servers_from_config
        }

        if self.autodetect:
            for spec in self._autodetect_language_servers():
                if tuple(sorted(spec["languages"])) not in langs:
                    language_servers += [spec]

        # restore config
        language_servers += language_servers_from_config

        # coalesce the servers, allowing a user to opt-out by specifying `[]`
        self.language_servers = [spec for spec in language_servers if spec["args"]]

    def subscribe(self, language, handler):
        session = None
        for langs, candidate_session in self.sessions.items():
            if language in langs:
                session = candidate_session
                break

        if session is None:
            for spec in self.language_servers:
                if language in spec["languages"]:
                    session = LanguageServerSession(spec["args"])
                    self.sessions[tuple(sorted(spec["languages"]))] = session
                    break

        if session:
            session.handlers += [handler]

        return session

    def _autodetect_language_servers(self):
        for ep in pkg_resources.iter_entry_points(EP_CONNECTOR_V0):
            try:
                connector: Connector = ep.load()
            except Exception as err:
                self.log.warn(
                    _("Failed to load language server connector `{}`: \n{}").format(
                        ep.name, err
                    )
                )
                continue

            try:
                for spec in connector(self):
                    yield spec
            except Exception as err:
                self.log.warning(
                    _(
                        "Failed to fetch commands from language server connector `{}`:"
                        "\n{}"
                    ).format(ep.name, err)
                )
                continue

    def find_node_module(self, *path_frag):
        """ look through the node_module roots to find the given node module
        """
        for candidate_root in self.extra_node_roots + self.node_roots:
            candidate = pathlib.Path(candidate_root, "node_modules", *path_frag)
            if candidate.exists():
                return str(candidate)


# Gotta be down here so it can by typed... really should have a IL
Connector = Callable[[LanguageServerManager], ConnectorCommands]
