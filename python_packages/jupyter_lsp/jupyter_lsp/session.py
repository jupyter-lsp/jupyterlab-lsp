""" A session for managing a language server process
"""
import atexit
import os
import string
import subprocess
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import List, Optional, cast

import anyio
from tornado.concurrent import run_on_executor
from tornado.ioloop import IOLoop
from tornado.queues import Queue
from tornado.websocket import WebSocketHandler
from traitlets import Bunch, Instance, Set, Unicode, UseEnum, observe
from traitlets.config import LoggingConfigurable

from .connection import LspStreamReader, LspStreamWriter
from .schema import LANGUAGE_SERVER_SPEC
from .trait_types import Schema
from .types import SessionStatus
from .utils import get_unused_port

# these are not desirable to publish to the frontend
SKIP_JSON_SPEC = ["argv", "debug_argv", "env"]


class LanguageServerSessionBase(LoggingConfigurable):
    """Manage a session for a connection to a language server"""

    language_server = Unicode(help="the language server implementation name")
    spec = Schema(LANGUAGE_SERVER_SPEC)

    # run-time specifics
    process = Instance(
        anyio.abc.Process, help="the language server subprocess", allow_none=True
    )
    executor = None
    portal = None
    cancelscope = None
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

    _skip_serialize = ["argv", "debug_argv"]

    def __init__(self, *args, **kwargs):
        """set up the required traitlets and exit behavior for a session"""
        super().__init__(*args, **kwargs)
        atexit.register(self.stop)
        self.executor = ThreadPoolExecutor(max_workers=1)
        self.start_blocking_portal()

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
            spec={k: v for k, v in self.spec.items() if k not in SKIP_JSON_SPEC},
        )

    def initialize(self):
        """(re)initialize a language server session"""
        self.stop()
        self.status = SessionStatus.STARTING
        self.init_queues()
        self.portal.call(self.init_process)
        self.init_writer()
        self.init_reader()

        # start listening on the executor in a different event loop
        self.listen()

        self.status = SessionStatus.STARTED

    def stop(self):
        """clean up all of the state of the session"""

        self.status = SessionStatus.STOPPING

        if self.cancelscope is not None:
            self.portal.call(self.cancelscope.cancel)
            self.cancelscope = None
        if self.reader:
            self.portal.call(self.reader.close)
            self.reader = None
        if self.writer:
            self.portal.call(self.writer.close)
            self.writer = None
        if self.process:
            self.portal.call(self.stop_process, 5)
            self.process = None

        self.status = SessionStatus.STOPPED

    @observe("handlers")
    def _on_handlers(self, change: Bunch):
        """re-initialize if someone starts listening, or stop if nobody is"""
        if change["new"] and not self.process:
            self.initialize()
        elif not change["new"] and self.process:
            self.stop()

    def write(self, message):
        """wrapper around the write queue to keep it mostly internal"""
        self.last_handler_message_at = self.now()
        IOLoop.current().add_callback(self.to_lsp.put_nowait, message)

    def now(self):
        return datetime.now(timezone.utc)

    # old definition of start_blocking_portal() prior to anyio3
    def start_blocking_portal(self):
        async def run_portal():
            nonlocal portal
            async with anyio.create_blocking_portal() as portal:
                event.set()
                await portal.sleep_until_stopped()

        portal: Optional[anyio.abc.BlockingPortal]
        event = threading.Event()
        thread = threading.Thread(target=anyio.run, kwargs={"func": run_portal})
        thread.start()
        event.wait()
        self.portal = cast(anyio.abc.BlockingPortal, portal)

    async def init_process(self):
        """start the language server subprocess"""
        # must be implemented by the base classes
        pass

    async def start_process(self, argv: List[str]):
        """start the language server subprocess giben in argv"""

        self.substitute_env(self.spec.get("env", {}), os.environ)

        # and start the process
        self.process = await anyio.open_process(
            argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE
        )

    async def stop_process(self, timeout: int = 5):
        """stop the language server subprocess

        If the process does not terminate within timeout seconds it will be killed
        forcefully.
        """
        if self.process is None:
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

    def init_reader(self):
        """create the stream reader (from the language server)"""
        # must be implemented by the base classes
        pass

    def init_writer(self):
        """create the stream writer (to the language server)"""
        # must be implemented by the base classes
        pass

    def substitute_env(self, env, base):
        for key, value in env.items():
            os.environ.update({key: string.Template(value).safe_substitute(base)})

    @run_on_executor
    def listen(self):
        self.portal.call(self._listen)

    async def _listen(self):
        try:
            async with anyio.create_task_group() as tg:
                self.cancelscope = tg.cancel_scope
                await tg.spawn(self._read_lsp)
                await tg.spawn(self._write_lsp)
                await tg.spawn(self._broadcast_from_lsp)
        except Exception as e:
            self.log.exception("Execption while listening {}", e)

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
        anyio.abc.SocketStream, help="the tcp connection", allow_none=True
    )

    async def init_process(self):
        """start the language server subprocess"""
        argv = self.spec["argv"]

        host, port, ext = self.get_tcp_server()
        # if server is already running in different process
        if ext:
            self.log.warning("Opening TCP connection to external process")
            # just connect to it and be done
            self.tcp_con = await self.init_tcp_connection(host, port)
            return

        # else substitute arguments for host and port into the environment
        argv = [arg.format(host=host, port=port) for arg in argv]

        # and start the process
        await self.start_process(argv)

        # finally connect to the now running process if in tcp mode
        self.tcp_con = await self.init_tcp_connection(host, port)

    async def stop_process(self, timeout: int = 5):
        await self.tcp_con.aclose()
        self.tcp_con = None

        await super().stop_process(timeout)

    def get_tcp_server(self):
        """Reads the TCP configuration parameters from the specification

        Returns a triple (host, port, ext), where ext is a boolean specifying whether
        the sever is running externaly.
        If neither a host nor a port is specified a randomly selected free port and
        host="127.0.0.1" will be returned.
        If a host but no port is specified a ValueError is raised.
        In all other cases the specified port and host will be returned.
        """
        host = self.spec.get("host")
        port = self.spec.get("port")
        ext = True

        if port is None:
            if host is None:
                host = "127.0.0.1"
                port = get_unused_port()
                ext = False
            else:
                raise ValueError(
                    "A port must be given explicitly if a host was specified"
                )
        else:
            if host is None:
                host = "127.0.0.1"
        return (host, port, ext)

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
                else:
                    self.log.warning(
                        "Connection to server {} refused! Attempt {}/{}.".format(
                            server, tries, retries
                        )
                    )
        raise OSError("Unable to connect to server {}".format(server))

    def init_reader(self):
        self.reader = LspStreamReader(
            stream=self.tcp_con, queue=self.from_lsp, parent=self
        )

    def init_writer(self):
        self.writer = LspStreamWriter(
            stream=self.tcp_con, queue=self.to_lsp, parent=self
        )
