""" A session for managing a language server process
"""
import atexit
import os
import string
import subprocess
from abc import ABC, ABCMeta, abstractmethod
from copy import copy
from datetime import datetime, timezone
from threading import Event, Thread
from typing import List

import anyio
from anyio import CancelScope
from anyio.abc import Process, SocketStream
from tornado.ioloop import IOLoop
from tornado.queues import Queue
from tornado.websocket import WebSocketHandler
from traitlets import Bunch, Float, Instance, Set, Unicode, UseEnum, observe
from traitlets.config import LoggingConfigurable
from traitlets.traitlets import MetaHasTraits

from .connection import LspStreamReader, LspStreamWriter
from .schema import LANGUAGE_SERVER_SPEC
from .specs.utils import censored_spec
from .trait_types import Schema
from .types import SessionStatus
from .utils import get_unused_port


class LanguageServerSessionMeta(MetaHasTraits, ABCMeta):
    pass


class LanguageServerSessionBase(
    LoggingConfigurable, ABC, metaclass=LanguageServerSessionMeta
):
    """Manage a session for a connection to a language server"""

    language_server = Unicode(help="the language server implementation name")
    spec = Schema(LANGUAGE_SERVER_SPEC)

    # run-time specifics
    process = Instance(
        Process, help="the language server subprocess", allow_none=True
    )
    cancelscope = Instance(
        CancelScope, help="scope used for stopping the session", allow_none=True)
    started = Instance(
        Event,
        args=(),
        help="event signaling that the session has finished starting",
        allow_none=False
    )
    thread = Instance(
        Thread,
        help="worker thread for running an event loop",
        allow_none=True
    )
    writer = Instance(LspStreamWriter, help="the JSON-RPC writer", allow_none=True)
    reader = Instance(LspStreamReader, help="the JSON-RPC reader", allow_none=True)
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
    status = UseEnum(SessionStatus, default_value=SessionStatus.NOT_STARTED)
    last_handler_message_at = Instance(datetime, allow_none=True)
    last_server_message_at = Instance(datetime, allow_none=True)

    stop_timeout = Float(
        5,
        help="timeout after which a process will be terminated forcefully",
    ).tag(config=True)

    _skip_serialize = ["argv", "debug_argv"]

    def __init__(self, *args, **kwargs):
        """set up the required traitlets and exit behavior for a session"""
        super().__init__(*args, **kwargs)
        atexit.register(self.stop)

    def __repr__(self):  # pragma: no cover
        return (
            "<LanguageServerSession(" "language_server={language_server}, argv={argv})>"
        ).format(language_server=self.language_server, **self.spec)

    def to_json(self):
        return dict(
            handler_count=len(self.handlers),
            status=self.status.value,
            last_server_message_at=self.last_server_message_at.isoformat()
            if self.last_server_message_at
            else None,
            last_handler_message_at=self.last_handler_message_at.isoformat()
            if self.last_handler_message_at
            else None,
            spec=censored_spec(self.spec),
        )

    def start(self):
        """run a language server session asynchronously inside a worker thread

           will return as soon as the session is ready for communication
        """
        self.started.clear()
        self.thread = Thread(target=anyio.run, kwargs={"func": self.run})
        self.thread.start()
        self.started.wait()

    def stop(self):
        """shut down the session"""
        if self.cancelscope is not None:
            self.cancelscope.cancel()
            self.cancelscope = None

        # wait for the session to get cleaned up
        if self.thread and self.thread.is_alive():
            self.thread.join()

    async def run(self):
        """run this session in a cancel scope and clean everything up on cancellation

        the event `self.started` will be set when everything is set up and the session
        will be ready for communication
        """
        async with CancelScope() as scope:
            self.cancelscope = scope
            await self.initialize()
            self.started.set()
            await self.listen()
        await self.cleanup()

    async def initialize(self):
        """initialize a language server session"""
        self.status = SessionStatus.STARTING

        self.init_queues()
        await self.init_process()
        self.init_writer()
        self.init_reader()

        self.status = SessionStatus.STARTED

    async def listen(self):
        """start the actual read/write tasks"""
        try:
            async with anyio.create_task_group() as tg:
                await tg.spawn(self._read_lsp)
                await tg.spawn(self._write_lsp)
                await tg.spawn(self._broadcast_from_lsp)
        except Exception as e:  # pragma: no cover
            self.log.exception("Execption while listening {}", e)

    async def cleanup(self):
        """clean up all of the state of the session"""
        self.status = SessionStatus.STOPPING

        if self.reader is not None:
            await self.reader.close()
            self.reader = None
        if self.writer is not None:
            await self.writer.close()
            self.writer = None
        if self.process is not None:
            await self.stop_process(self.stop_timeout)
            self.process = None

        self.status = SessionStatus.STOPPED

    @observe("handlers")
    def _on_handlers(self, change: Bunch):
        """re-initialize if someone starts listening, or stop if nobody is"""
        if change["new"] and not self.process:
            self.start()
        elif not change["new"] and self.process:
            self.stop()

    def write(self, message):
        """wrapper around the write queue to keep it mostly internal"""
        self.last_handler_message_at = self.now()
        IOLoop.current().add_callback(self.to_lsp.put_nowait, message)

    def now(self):
        return datetime.now(timezone.utc)

    async def start_process(self, argv: List[str]):
        """start the language server subprocess giben in argv"""
        self.process = await anyio.open_process(
            argv,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            env=self.substitute_env(self.spec.get("env", {}), os.environ),
        )

    async def stop_process(self, timeout: int = 5):
        """stop the language server subprocess

        If the process does not terminate within timeout seconds it will be killed
        forcefully.
        """
        if self.process is None:  # pragma: no cover
            return

        # try to stop the process gracefully
        self.process.terminate()
        with anyio.move_on_after(timeout):
            self.log.debug("Waiting for process to terminate")
            await self.process.wait()
            return

        self.log.debug(
            (
                "Process did not terminate within {} seconds. "
                "Bringing it down the hard way!"
            ).format(timeout)
        )
        self.process.kill()

    def init_queues(self):
        """create the queues"""
        self.from_lsp = Queue()
        self.to_lsp = Queue()

    def substitute_env(self, env, base):
        final_env = copy(os.environ)

        for key, value in env.items():
            final_env.update({key: string.Template(value).safe_substitute(base)})

        return final_env

    @abstractmethod
    async def init_process(self):
        """start the language server subprocess and store it in self.process"""
        pass  # pragma: no cover

    @abstractmethod
    def init_reader(self):
        """create the stream reader (from the language server) and store it in
        self.reader
        """
        pass  # pragma: no cover

    @abstractmethod
    def init_writer(self):
        """create the stream writer (to the language server) and store it in
        self.writer
        """
        pass  # pragma: no cover

    async def _read_lsp(self):
        await self.reader.read()

    async def _write_lsp(self):
        await self.writer.write()

    async def _broadcast_from_lsp(self):
        """loop for reading messages from the queue of messages from the language
        server
        """
        async for message in self.from_lsp:
            self.last_server_message_at = self.now()
            await self.parent.on_server_message(message, self)
            self.from_lsp.task_done()


class LanguageServerSessionStdio(LanguageServerSessionBase):
    async def init_process(self):
        await self.start_process(self.spec["argv"])

    def init_reader(self):
        self.reader = LspStreamReader(
            stream=self.process.stdout, queue=self.from_lsp, parent=self
        )

    def init_writer(self):
        self.writer = LspStreamWriter(
            stream=self.process.stdin, queue=self.to_lsp, parent=self
        )


class LanguageServerSessionTCP(LanguageServerSessionBase):

    tcp_con = Instance(
        SocketStream, help="the tcp connection", allow_none=True
    )

    async def init_process(self):
        """start the language server subprocess"""
        argv = self.spec["argv"]

        host = "127.0.0.1"
        port = get_unused_port()

        # substitute arguments for host and port into the environment
        argv = [arg.format(host=host, port=port) for arg in argv]

        # start the process
        await self.start_process(argv)

        # finally open the tcp connection to the now running process
        self.tcp_con = await self.init_tcp_connection(host, port)

    async def stop_process(self, timeout: int = 5):
        await self.tcp_con.aclose()
        self.tcp_con = None

        await super().stop_process(timeout)

    async def init_tcp_connection(self, host, port, retries=12, sleep=5.0):
        server = "{}:{}".format(host, port)

        tries = 0
        while tries < retries:
            tries = tries + 1
            try:
                return await anyio.connect_tcp(host, port)
            except OSError:
                if tries < retries:
                    self.log.warning(
                        (
                            "Connection to server {} refused! "
                            "Attempt {}/{}. "
                            "Retrying in {}s"
                        ).format(server, tries, retries, sleep)
                    )
                    await anyio.sleep(sleep)
                else:  # pragma: no cover
                    self.log.warning(
                        "Connection to server {} refused! Attempt {}/{}.".format(
                            server, tries, retries
                        )
                    )
        raise OSError(
            "Unable to connect to server {}".format(server)
        )  # pragma: no cover

    def init_reader(self):
        self.reader = LspStreamReader(
            stream=self.tcp_con, queue=self.from_lsp, parent=self
        )

    def init_writer(self):
        self.writer = LspStreamWriter(
            stream=self.tcp_con, queue=self.to_lsp, parent=self
        )
