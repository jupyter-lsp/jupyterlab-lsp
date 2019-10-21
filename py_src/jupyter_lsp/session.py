""" A session for managing a language server process
"""
import asyncio
import atexit
import subprocess

from tornado.queues import Queue
from tornado.websocket import WebSocketHandler
from traitlets import Bunch, Instance, List, Set, Unicode, observe
from traitlets.config import LoggingConfigurable

from . import stdio


class LanguageServerSession(LoggingConfigurable):
    """ Manage a session for a connection to a language server
    """

    argv = List(
        trait=Unicode,
        default_value=[],
        help="the command line arguments to start the language server",
    )
    languages = List(
        trait=Unicode,
        default_value=[],
        help="the languages this session can provide language server features",
    )
    process = Instance(
        subprocess.Popen, help="the language server subprocess", allow_none=True
    )
    writer = Instance(stdio.LspStdIoWriter, help="the JSON-RPC writer", allow_none=True)
    reader = Instance(stdio.LspStdIoReader, help="the JSON-RPC reader", allow_none=True)
    from_lsp = Instance(
        Queue, help="a queue for string messages from the server", allow_none=True
    )
    to_lsp = Instance(
        Queue, help="a queue for string message to the server", allow_none=True
    )
    handlers = Set(
        trait=Instance(WebSocketHandler),
        default_value=[],
        help="the currently subscribed websockets",
    )

    _tasks = None

    def __init__(self, *args, **kwargs):
        """ set up the required traitlets and exit behavior for a session
        """
        super().__init__(*args, **kwargs)
        atexit.register(self.stop)

    def __repr__(self):  # pragma: no cover
        return "<LanguageServerSession(languages={}, argv={})>".format(
            self.languages, self.argv
        )

    def initialize(self):
        """ (re)initialize a language server session
        """
        self.stop()
        self.init_queues()
        self.init_process()
        self.init_writer()
        self.init_reader()

        loop = asyncio.get_event_loop()
        self._tasks = [
            loop.create_task(coro())
            for coro in [self._read_lsp, self._write_lsp, self._broadcast_from_lsp]
        ]

    def stop(self):
        """ clean up all of the state of the session
        """
        if self.process:
            self.process.terminate()
            self.process = None
        if self.reader:
            self.reader.close()
            self.reader = None
        if self.writer:
            self.writer.close()
            self.writer = None

        if self._tasks:
            [task.cancel() for task in self._tasks]

    @observe("handlers")
    def _on_handlers(self, change: Bunch):
        """ re-initialize if someone starts listening, or stop if nobody is
        """
        if change["new"] and not self.process:
            self.initialize()
        elif not change["new"] and self.process:
            self.stop()

    def write(self, message):
        """ wrapper around the write queue to keep it mostly internal
        """
        self.to_lsp.put_nowait(message)

    def init_process(self):
        """ start the language server subprocess
        """
        self.process = subprocess.Popen(
            self.argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE
        )

    def init_queues(self):
        """ create the queues
        """
        self.from_lsp = Queue()
        self.to_lsp = Queue()

    def init_reader(self):
        """ create the stdout reader (from the language server)
        """
        self.reader = stdio.LspStdIoReader(
            stream=self.process.stdout, queue=self.from_lsp, parent=self
        )

    def init_writer(self):
        """ create the stdin writer (to the language server)
        """
        self.writer = stdio.LspStdIoWriter(
            stream=self.process.stdin, queue=self.to_lsp, parent=self
        )

    async def _read_lsp(self):
        await self.reader.read()

    async def _write_lsp(self):
        await self.writer.write()

    async def _broadcast_from_lsp(self):
        """ loop for reading messages from the queue of messages from the language
            server
        """
        async for msg in self.from_lsp:
            for handler in self.handlers:
                handler.write_message(msg)
            self.from_lsp.task_done()
