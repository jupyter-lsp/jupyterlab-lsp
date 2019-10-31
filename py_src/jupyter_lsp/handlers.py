""" tornado handler for managing and communicating with language servers
"""
from typing import Optional, Text

from notebook.base.handlers import IPythonHandler
from notebook.base.zmqhandlers import WebSocketHandler, WebSocketMixin
from tornado.ioloop import IOLoop

from .manager import LanguageServerManager


class BaseHandler(IPythonHandler):
    manager = None  # type: LanguageServerManager

    def initialize(self, manager: LanguageServerManager):
        self.manager = manager


class LanguageServerWebSocketHandler(WebSocketMixin, WebSocketHandler, BaseHandler):
    """ Setup tornado websocket to route to language server sessions
    """

    language = None  # type: Optional[Text]

    def open(self, language):
        self.language = language
        self.manager.subscribe(self)
        self.log.debug("[{0: >16}] Opened a handler".format(self.language))

    def on_message(self, message):
        def send(message):
            self.log.debug("[{0: >16}] Handling a message".format(self.language))
            self.manager.on_message(message, self)
            self.log.debug("[{0: >16}] Handled a message".format(self.language))

        IOLoop.current().spawn_callback(send, message)

    def on_close(self):
        self.manager.unsubscribe(self)
        self.log.debug("[{0: >16}] Closed a handler".format(self.language))


class LanguageServersHandler(BaseHandler):
    """ Reports the status of all current servers

        Response should conform to schema in schema/servers.schema.json
    """

    def get(self):
        """ finish with the JSON representations of the sessions
        """
        self.finish(
            {
                "version": 0,
                "sessions": sorted(
                    [session.to_json() for session in self.manager.sessions.values()],
                    key=lambda session: session["languages"],
                ),
            }
        )
