import json

from ipykernel.comm import Comm
from tornado.ioloop import IOLoop

from ..types import LangaugeServerClientAPI


class CommHandler(LangaugeServerClientAPI):
    """ Jupyter Kernel Comm-based transport

        The interface is mostly derived from the tornado.websocket.WebSocketHandler
    """

    comm = None  # type: Comm

    def initialize(self, manager):
        self.manager = manager
        self.comm.on_msg(self.on_message_sync)
        self.comm.send(data={}, metadata=self.manager.get_status_response())

    def open(self, language_server):
        self.language_server = language_server
        self.manager.subscribe(self)
        self.log.debug("[{}] Opened a handler".format(self.language_server))

    def on_close(self):
        self.manager.unsubscribe(self)
        self.log.debug("[{}] Closed a handler".format(self.language_server))

    @property
    def log(self):
        return self.manager.log

    def on_message_sync(self, message):  # pragma: no cover
        """ shim to put the message handler on the event loop
        """
        IOLoop.current().add_callback(self.on_message, message)

    async def on_message(self, message):
        self.log.debug("[{}] Got a message".format(self.language_server))

        message_str = message

        if isinstance(message, dict):  # pragma: no cover
            data = message.get("content", {}).get("data")
            metadata = message.get("metadata")
            if not data and metadata:
                self.log.debug("[{}] Sending status".format(self.language_server))
                self.comm.send(data={}, metadata=self.manager.get_status_response())
                return

            message_str = json.dumps(data)

        await self.manager.on_client_message(message_str, self)
        self.log.debug("[{}] Finished handling message".format(self.language_server))

    def write_message(self, message: str):  # pragma: no cover
        self.comm.send(json.loads(message))
