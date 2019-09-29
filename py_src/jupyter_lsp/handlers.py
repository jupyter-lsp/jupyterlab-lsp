from notebook.base.handlers import IPythonHandler
from notebook.base.zmqhandlers import WebSocketHandler, WebSocketMixin
from tornado.ioloop import IOLoop


class LanguageServerWebSocketHandler(WebSocketMixin, WebSocketHandler, IPythonHandler):
    """ Setup tornado websocket to route to language server
    """

    session = None
    language = None

    def initialize(self, manager):
        self.manager = manager

    def open(self, language):
        self.language = language
        self.session = self.manager.subscribe(language, self)
        self.log.debug("[{0: >16}] Opened a handler".format(self.language))

    def on_message(self, message):
        def send(message):
            self.log.debug("[{0: >16}] Handling a message".format(self.language))
            self.session.write(message)
            self.log.debug("[{0: >16}] Handled a message".format(self.language))

        IOLoop.current().spawn_callback(send, message)

    def on_close(self):
        if self.session:
            self.session.handlers.remove(self)
            self.session = None
        self.log.debug("[{0: >16}] Closed a handler".format(self.language))
