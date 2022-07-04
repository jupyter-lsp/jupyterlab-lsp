""" Language Server readers and writers

Parts of this code are derived from:

> https://github.com/palantir/python-jsonrpc-server/blob/0.2.0/pyls_jsonrpc/streams.py#L83   # noqa
> https://github.com/palantir/python-jsonrpc-server/blob/45ed1931e4b2e5100cc61b3992c16d6f68af2e80/pyls_jsonrpc/streams.py  # noqa
> > MIT License   https://github.com/palantir/python-jsonrpc-server/blob/0.2.0/LICENSE
> > Copyright 2018 Palantir Technologies, Inc.
"""
from abc import ABC, ABCMeta, abstractmethod
from typing import Text

# pylint: disable=broad-except
import anyio
from anyio.streams.buffered import BufferedByteReceiveStream
from anyio.streams.text import TextSendStream
from anyio.streams.stapled import StapledObjectStream
from tornado.httputil import HTTPHeaders
from traitlets import Instance, Int
from traitlets.config import LoggingConfigurable
from traitlets.traitlets import MetaHasTraits


class LspStreamMeta(MetaHasTraits, ABCMeta):
    pass


class LspStreamBase(LoggingConfigurable, ABC, metaclass=LspStreamMeta):
    """Non-blocking, queued base for communicating with Language Servers through anyio
    streams
    """

    queue = Instance(StapledObjectStream, help="queue to get/put")

    def __repr__(self):  # pragma: no cover
        return "<{}(parent={})>".format(self.__class__.__name__, self.parent)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.log.debug("%s initialized", self)

    @abstractmethod
    async def close(self):
        pass  # pragma: no cover


class LspStreamReader(LspStreamBase):
    """Language Server Reader"""

    receive_max_bytes = Int(
        65536,
        help="the maximum size a header line send by the language server may have",
    ).tag(config=True)

    stream = Instance(  # type:ignore[assignment]
        BufferedByteReceiveStream, help="the stream to read from"
    )  # type: BufferedByteReceiveStream

    def __init__(self, stream: anyio.abc.ByteReceiveStream, **kwargs):
        super().__init__(**kwargs)
        self.stream = BufferedByteReceiveStream(stream)

    async def close(self):
        await self.stream.aclose()
        self.log.debug("%s closed", self)

    async def read(self) -> None:
        """Read from a Language Server until it is closed"""
        while True:
            message = None
            try:
                message = await self.read_one()
                await self.queue.send(message)
            except anyio.ClosedResourceError:
                # stream was closed -> terminate
                self.log.debug("Stream closed while a read was still in progress")
                break
            except Exception as e:  # pragma: no cover
                self.log.exception(
                    "%s couldn't enqueue message: %s (%s)", self, message, e
                )

    async def _read_content(self, length: int) -> bytes:
        """Read the full length of the message.

        Args:
           - length: the content length
        """
        try:
            return await self.stream.receive_exactly(length)
        except anyio.IncompleteRead:  # pragma: no cover
            # resource has been closed before the requested bytes could be retrieved
            # -> signal recource closed
            raise anyio.ClosedResourceError

    async def read_one(self) -> Text:
        """Read a single message"""
        message = ""
        headers = HTTPHeaders()

        line = await self._readline()

        if line:
            while line and line.strip():
                headers.parse_line(line)
                line = await self._readline()

            content_length = int(headers.get("content-length", "0"))

            if content_length:
                raw = await self._read_content(length=content_length)
                message = raw.decode("utf-8").strip()

        return message

    async def _readline(self) -> Text:
        """Read a line"""
        try:
            # use same max_bytes as is default for receive for now. It seems there is no
            # way of getting the bytes read until max_bytes is reached, so we cannot
            # iterate the receive_until call with smaller max_bytes values
            line = await self.stream.receive_until(b"\r\n", self.receive_max_bytes)
            return line.decode("utf-8").strip()
        except anyio.IncompleteRead:
            # resource has been closed before the requested bytes could be retrieved
            # -> signal recource closed
            raise anyio.ClosedResourceError
        except anyio.DelimiterNotFound:  # pragma: no cover
            self.log.error(
                "Readline hit max_bytes before newline character was encountered"
            )
            return ""


class LspStreamWriter(LspStreamBase):
    """Language Server Writer"""

    stream = Instance(  # type:ignore[assignment]
        TextSendStream, help="the stream to write to"
    )  # type: TextSendStream

    def __init__(self, stream: anyio.abc.ByteSendStream, **kwargs):
        super().__init__(**kwargs)
        self.stream = TextSendStream(stream, encoding="utf-8")

    async def close(self):
        await self.stream.aclose()
        self.log.debug("%s closed", self)

    async def write(self) -> None:
        """Write to a Language Server until it closes"""
        while True:
            message = await self.queue.receive()
            try:
                n_bytes = len(message.encode("utf-8"))
                response = "Content-Length: {}\r\n\r\n{}".format(n_bytes, message)
                await self._write_one(response)
            except (
                anyio.ClosedResourceError,
                anyio.BrokenResourceError,
            ):  # pragma: no cover
                # stream was closed -> terminate
                self.log.debug("Stream closed while a write was still in progress")
                break
            except Exception:  # pragma: no cover
                self.log.exception("%s couldn't write message: %s", self, response)

    async def _write_one(self, message) -> None:
        await self.stream.send(message)
