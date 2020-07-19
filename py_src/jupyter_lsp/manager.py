""" A configurable frontend for stdio-based Language Servers
"""
import traceback
from typing import Dict, Text, Tuple

import entrypoints
from tornado.gen import maybe_future
from traitlets import Bool, Dict as Dict_, Instance, List as List_, default

from .constants import (
    EP_LISTENER_ALL_V1,
    EP_LISTENER_CLIENT_V1,
    EP_LISTENER_SERVER_V1,
    EP_SPEC_V1,
)
from .schema import LANGUAGE_SERVER_SPEC_MAP
from .session import LanguageServerSession
from .trait_types import LoadableCallable, Schema
from .types import (
    KeyedLanguageServerSpecs,
    LanguageServerManagerAPI,
    MessageScope,
    SpecMaker,
)


class LanguageServerManager(LanguageServerManagerAPI):
    """ Manage language servers
    """

    language_servers = Schema(
        validator=LANGUAGE_SERVER_SPEC_MAP,
        help="a dict of language server specs, keyed by implementation",
    ).tag(
        config=True
    )  # type: KeyedLanguageServerSpecs

    autodetect = Bool(
        True, help="try to find known language servers in sys.prefix (and elsewhere)"
    ).tag(
        config=True
    )  # type: bool

    sessions = Dict_(
        trait=Instance(LanguageServerSession),
        default_value={},
        help="sessions keyed by language server name",
    )  # type: Dict[Tuple[Text], LanguageServerSession]

    all_listeners = List_(trait=LoadableCallable).tag(config=True)
    server_listeners = List_(trait=LoadableCallable).tag(config=True)
    client_listeners = List_(trait=LoadableCallable).tag(config=True)

    @default("language_servers")
    def _default_language_servers(self):
        return {}

    def __init__(self, **kwargs):
        """ Before starting, perform all necessary configuration
        """
        super().__init__(**kwargs)

    def initialize(self, *args, **kwargs):
        self.init_language_servers()
        self.init_listeners()
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
            key: spec for key, spec in language_servers.items() if spec.get("argv")
        }

    def init_sessions(self):
        """ create, but do not initialize all sessions
        """
        sessions = {}
        for language_server, spec in self.language_servers.items():
            sessions[language_server] = LanguageServerSession(
                language_server=language_server, spec=spec, parent=self
            )
        self.sessions = sessions

    def init_listeners(self):
        """ register traitlets-configured listeners
        """

        scopes = {
            MessageScope.ALL: [self.all_listeners, EP_LISTENER_ALL_V1],
            MessageScope.CLIENT: [self.client_listeners, EP_LISTENER_CLIENT_V1],
            MessageScope.SERVER: [self.server_listeners, EP_LISTENER_SERVER_V1],
        }
        for scope, trt_ep in scopes.items():
            listeners, entry_point = trt_ep

            for ep_name, ept in entrypoints.get_group_named(
                entry_point
            ).items():  # pragma: no cover
                try:
                    listeners.append(ept.load())
                except Exception as err:
                    self.log.warning("Failed to load entry point %s: %s", ep_name, err)

            for listener in listeners:
                self.__class__.register_message_listener(scope=scope.value)(listener)

    def subscribe(self, handler):
        """ subscribe a handler to session, or sta
        """
        session = self.sessions.get(handler.language_server)

        if session is None:
            self.log.error(
                "[{}] no session: handler subscription failed".format(
                    handler.language_server
                )
            )
            return

        session.handlers = set([handler]) | session.handlers

    async def on_client_message(self, message, handler):
        await self.wait_for_listeners(
            MessageScope.CLIENT, message, handler.language_server
        )
        session = self.sessions.get(handler.language_server)

        if session is None:
            self.log.error(
                "[{}] no session: client message dropped".format(
                    handler.language_server
                )
            )
            return

        session.write(message)

    async def on_server_message(self, message, session):
        language_servers = [
            ls_key for ls_key, sess in self.sessions.items() if sess == session
        ]

        for language_servers in language_servers:
            await self.wait_for_listeners(
                MessageScope.SERVER, message, language_servers
            )

        for handler in session.handlers:
            await maybe_future(handler.write_message(message))

    def unsubscribe(self, handler):
        session = self.sessions.get(handler.language_server)

        if session is None:
            self.log.error(
                "[{}] no session: handler unsubscription failed".format(
                    handler.language_server
                )
            )
            return

        session.handlers = [h for h in session.handlers if h != handler]

    def _autodetect_language_servers(self):
        entry_points = []

        try:
            entry_points = entrypoints.get_group_named(EP_SPEC_V1)
        except Exception:  # pragma: no cover
            self.log.exception("Failed to load entry_points")

        for ep_name, ep in entry_points.items():
            try:
                spec_finder = ep.load()  # type: SpecMaker
            except Exception as err:  # pragma: no cover
                self.log.warn(
                    "Failed to load language server spec finder `{}`: \n{}".format(
                        ep_name, err
                    )
                )
                continue

            try:
                specs = spec_finder(self)
            except Exception as err:  # pragma: no cover
                self.log.warning(
                    (
                        "Failed to fetch commands from language server spec finder"
                        "`{}`:\n{}"
                    ).format(ep.name, err)
                )
                traceback.print_exc()

                continue

            errors = list(LANGUAGE_SERVER_SPEC_MAP.iter_errors(specs))

            if errors:  # pragma: no cover
                self.log.warning(
                    (
                        "Failed to validate commands from language server spec finder"
                        "`{}`:\n{}"
                    ).format(ep.name, errors)
                )
                continue

            for key, spec in specs.items():
                yield key, spec


# the listener decorator
lsp_message_listener = LanguageServerManager.register_message_listener  # noqa
