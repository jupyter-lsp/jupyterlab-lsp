""" A configurable frontend for `python-jsonrpc-server`
"""
from typing import Dict, Text, Tuple

import pkg_resources
from notebook.transutils import _
from traitlets import Bool, Dict as Dict_, Instance

from .constants import EP_CONNECTOR_V0
from .session import LanguageServerSession
from .types import KeyedLanguageServerSpecs, LanguageServerManagerAPI, SpecMaker


class LanguageServerManager(LanguageServerManagerAPI):
    """ Manage language servers
    """

    language_servers = Dict_(
        trait=Dict_,
        default_value=[],
        help=_("a dict of language server specs, keyed by implementation"),
    ).tag(
        config=True
    )  # type: KeyedLanguageServerSpecs

    autodetect = Bool(
        True, help=_("try to find known language servers in sys.prefix (and elsewhere)")
    ).tag(
        config=True
    )  # type: bool

    sessions = Dict_(
        trait=Instance(LanguageServerSession),
        default_value={},
        help="sessions keyed by languages served",
    )  # type: Dict[Tuple[Text], LanguageServerSession]

    def __init__(self, **kwargs):
        """ Before starting, perform all necessary configuration
        """
        super().__init__(**kwargs)

    def initialize(self, *args, **kwargs):
        self.init_language_servers()
        self.init_sessions()

    def init_language_servers(self) -> None:
        """ determine the final language server configuration.
        """
        language_servers = {}  # type: KeyedLanguageServerSpecs

        # copy the language servers before anybody monkeys with them
        language_servers_from_config = dict(self.language_servers)

        if self.autodetect:
            language_servers.update(self._autodetect_language_servers())

        # restore config
        language_servers.update(language_servers_from_config)

        # coalesce the servers, allowing a user to opt-out by specifying `[]`
        self.language_servers = {
            key: spec
            for key, spec in language_servers.items()
            if spec.get("argv") and spec.get("languages")
        }

    def init_sessions(self):
        """ create, but do not initialize all sessions
        """
        sessions = {}
        for spec in self.language_servers.values():
            sessions[tuple(sorted(spec["languages"]))] = LanguageServerSession(
                spec["argv"]
            )
        self.sessions = sessions

    def subscribe(self, language, handler):
        """ subscribe a handler to session, or sta
        """
        session = None
        for langs, candidate_session in self.sessions.items():
            if language in langs:
                session = candidate_session
                break

        if session:
            session.handlers += [handler]
            if not session.process:
                session.initialize()

        return session

    def _autodetect_language_servers(self):
        for ep in pkg_resources.iter_entry_points(EP_CONNECTOR_V0):
            try:
                connector = ep.load()  # type: SpecMaker
            except Exception as err:
                self.log.warn(
                    _("Failed to load language server connector `{}`: \n{}").format(
                        ep.name, err
                    )
                )
                continue

            try:
                for key, spec in connector(self).items():
                    yield key, spec
            except Exception as err:
                self.log.warning(
                    _(
                        "Failed to fetch commands from language server connector `{}`:"
                        "\n{}"
                    ).format(ep.name, err)
                )
                continue
