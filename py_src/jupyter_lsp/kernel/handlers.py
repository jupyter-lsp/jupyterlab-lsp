import json

from tornado.ioloop import IOLoop


class CommHandler:
    """ Jupyter Kernel Comm-based transport that imitates the tornado websocket handler
    """

    comm = None
    subscribed = None

    def __init__(self, language_server, comm, manager):
        self.language_server = language_server
        self.comm = comm
        self.manager = manager
        self.subscribed = False
        comm.on_msg(self.on_message_sync)
        self.log.error("[{}] on_msg installed".format(self.language_server))

    @property
    def log(self):
        return self.manager.log

    def on_message_sync(self, message):
        """ shim to put the message handler on the event loop
        """
        IOLoop.current().add_callback(self.on_message, message)

    async def on_message(self, message):
        self.log.error("[{}] Got a message".format(self.language_server))
        if not self.subscribed:
            self.manager.subscribe(self)
            self.subscribed = True
        await self.manager.on_client_message(
            json.dumps(message["content"]["data"]), self
        )
        self.log.error("[{}] Finished handling message".format(self.language_server))

    def write_message(self, message: str):
        self.log.error(
            "[{}] Sending a message: {}".format(self.language_server, message)
        )
        self.comm.send(json.loads(message))
