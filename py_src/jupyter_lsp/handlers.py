from notebook.base.handlers import IPythonHandler
from notebook.base.zmqhandlers import WebSocketHandler, WebSocketMixin


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

    def on_message(self, message):
        self.session.write(message)

    def on_close(self):
        self.session.handlers.remove(self)
