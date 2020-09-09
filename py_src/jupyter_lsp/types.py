""" API used by spec finders and manager
"""
import asyncio
import enum
import json
import pathlib
import re
import shutil
import sys
from typing import (
    TYPE_CHECKING,
    Any,
    Awaitable,
    Callable,
    Dict,
    List,
    Optional,
    Pattern,
    Text,
)

from notebook.transutils import _
from traitlets import Instance, List as List_, Unicode, default
from traitlets.config import LoggingConfigurable

LanguageServerSpec = Dict[Text, Any]
LanguageServerMessage = Dict[Text, Any]
KeyedLanguageServerSpecs = Dict[Text, LanguageServerSpec]

if TYPE_CHECKING:  # pragma: no cover
    from typing_extensions import Protocol

    class HandlerListenerCallback(Protocol):
        def __call__(
            self,
            scope: Text,
            message: LanguageServerMessage,
            language_server: Text,
            manager: "HasListeners",
        ) -> Awaitable[None]:
            ...


class SessionStatus(enum.Enum):
    """States in which a language server session can be"""

    NOT_STARTED = "not_started"
    STARTING = "starting"
    STARTED = "started"
    STOPPING = "stopping"
    STOPPED = "stopped"


class MessageScope(enum.Enum):
    """Scopes for message listeners"""

    ALL = "all"
    CLIENT = "client"
    SERVER = "server"


class MessageListener(object):
    """A base listener implementation"""

    listener = None  # type: HandlerListenerCallback
    language_server = None  # type: Optional[Pattern[Text]]
    method = None  # type: Optional[Pattern[Text]]

    def __init__(
        self,
        listener: "HandlerListenerCallback",
        language_server: Optional[Text],
        method: Optional[Text],
    ):
        self.listener = listener
        self.language_server = re.compile(language_server) if language_server else None
        self.method = re.compile(method) if method else None

    async def __call__(
        self,
        scope: Text,
        message: LanguageServerMessage,
        language_server: Text,
        manager: "HasListeners",
    ) -> None:
        """actually dispatch the message to the listener and capture any errors"""
        try:
            await self.listener(
                scope=scope,
                message=message,
                language_server=language_server,
                manager=manager,
            )
        except Exception:  # pragma: no cover
            manager.log.warn(
                "[lsp] error in listener %s for message %s",
                self.listener,
                message,
                exc_info=True,
            )

    def wants(self, message: LanguageServerMessage, language_server: Text):
        """whether this listener wants a particular message

        `method` is currently the only message content discriminator, but not
        all messages will have a `method`
        """
        if self.method:
            method = message.get("method")

            if method is None or re.match(self.method, method) is None:
                return False
        return self.language_server is None or re.match(
            self.language_server, language_server
        )

    def __repr__(self):
        return (
            "<MessageListener"
            " listener={self.listener},"
            " method={self.method},"
            " language_server={self.language_server}>"
        ).format(self=self)


class HasListeners:
    _listeners = {
        str(scope.value): [] for scope in MessageScope
    }  # type: Dict[Text, List[MessageListener]]

    log = Instance("logging.Logger")

    @classmethod
    def register_message_listener(
        cls,
        scope: Text,
        language_server: Optional[Text] = None,
        method: Optional[Text] = None,
    ):
        """register a listener for language server protocol messages"""

        def inner(listener: "HandlerListenerCallback") -> "HandlerListenerCallback":
            cls.unregister_message_listener(listener)
            cls._listeners[scope].append(
                MessageListener(
                    listener=listener, language_server=language_server, method=method
                )
            )
            return listener

        return inner

    @classmethod
    def unregister_message_listener(cls, listener: "HandlerListenerCallback"):
        """unregister a listener for language server protocol messages"""
        for scope in MessageScope:
            cls._listeners[str(scope.value)] = [
                lst
                for lst in cls._listeners[str(scope.value)]
                if lst.listener != listener
            ]

    async def wait_for_listeners(
        self, scope: MessageScope, message_str: Text, language_server: Text
    ) -> None:
        scope_val = str(scope.value)
        listeners = self._listeners[scope_val] + self._listeners[MessageScope.ALL.value]

        if listeners:
            message = json.loads(message_str)

            futures = [
                listener(
                    scope_val,
                    message=message,
                    language_server=language_server,
                    manager=self,
                )
                for listener in listeners
                if listener.wants(message, language_server)
            ]

            if futures:
                await asyncio.gather(*futures)


class LanguageServerManagerAPI(LoggingConfigurable, HasListeners):
    """Public API that can be used for python-based spec finders and listeners"""

    nodejs = Unicode(help=_("path to nodejs executable")).tag(config=True)

    node_roots = List_([], help=_("absolute paths in which to seek node_modules")).tag(
        config=True
    )

    extra_node_roots = List_(
        [], help=_("additional absolute paths to seek node_modules first")
    ).tag(config=True)

    def find_node_module(self, *path_frag):
        """look through the node_module roots to find the given node module"""
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
                "{} not found in node_modules of {}".format(
                    pathlib.Path(*path_frag), all_roots
                )
            )

        return found

    @default("nodejs")
    def _default_nodejs(self):
        return (
            shutil.which("node") or shutil.which("nodejs") or shutil.which("nodejs.exe")
        )

    @default("node_roots")
    def _default_node_roots(self):
        """get the "usual suspects" for where `node_modules` may be found

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
