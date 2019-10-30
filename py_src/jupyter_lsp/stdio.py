""" Language Server stdio-mode readers

Parts of this code are derived from:

> https://github.com/palantir/python-jsonrpc-server/blob/0.2.0/pyls_jsonrpc/streams.py#L83   # noqa
> https://github.com/palantir/python-jsonrpc-server/blob/45ed1931e4b2e5100cc61b3992c16d6f68af2e80/pyls_jsonrpc/streams.py  # noqa
> > MIT License   https://github.com/palantir/python-jsonrpc-server/blob/0.2.0/LICENSE
> > Copyright 2018 Palantir Technologies, Inc.
"""
# pylint: disable=broad-except
import asyncio
import io
import os
from typing import Text

from tornado.httputil import HTTPHeaders
from tornado.queues import Queue
from traitlets import Float, Instance, default
from traitlets.config import LoggingConfigurable

from .non_blocking import make_non_blocking


class LspStdIoBase(LoggingConfigurable):
    """ Non-blocking, queued base for communicating with stdio Language Servers
    """

    stream = Instance(io.BufferedIOBase, help="the stream to read/write")
    queue = Instance(Queue, help="queue to get/put")

    def __repr__(self):  # pragma: no cover
        return "<{}(parent={})>".format(self.__class__.__name__, self.parent)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.log.debug("%s initialized", self)

    def close(self):
        self.stream.close()
        self.log.debug("%s closed", self)


class LspStdIoReader(LspStdIoBase):
    """ Language Server stdio Reader

        Because non-blocking (but still synchronous) IO is used, rudimentary
        exponential backoff is used.
    """

    max_wait = Float(help="maximum time to wait on idle stream").tag(config=True)
    min_wait = Float(0.05, help="minimum time to wait on idle stream").tag(config=True)
    next_wait = Float(0.05, help="next time to wait on idle stream").tag(config=True)

    @default("max_wait")
    def _default_max_wait(self):
        return 2.0 if os.name == "nt" else self.min_wait

    async def sleep(self):
        """ Simple exponential backoff for sleeping
        """
        if self.stream.closed:  # pragma: no cover
            return
        self.next_wait = min(self.next_wait * 2, self.max_wait)
        try:
            await asyncio.sleep(self.next_wait)
        except Exception:  # pragma: no cover
            pass

    def wake(self):
        """ Reset the wait time
        """
        self.wait = self.min_wait

    async def read(self) -> None:
        """ Read from a Language Server until it is closed
        """
        make_non_blocking(self.stream)

        while not self.stream.closed:
            message = None
            try:
                message = await self.read_one()

                if not message:
                    await self.sleep()
                    continue
                else:
                    self.wake()

                await self.queue.put(message)
            except Exception:  # pragma: no cover
                self.log.exception("%s couldn't enqueue message: %s", self, message)
                await self.sleep()

    async def read_one(self) -> Text:
        """ Read a single message
        """
        message = ""
        headers = HTTPHeaders()

        line = self._readline()

        if line:
            while line and line.strip():
                headers.parse_line(line)
                line = self._readline()

            content_length = int(headers.get("content-length", "0"))

            if content_length:
                raw = None
                retries = 5
                while raw is None and retries:
                    try:
                        raw = self.stream.read(content_length)
                    except OSError:  # pragma: no cover
                        raw = None
                    if raw is None:  # pragma: no cover
                        self.log.warning(
                            "%s failed to read message of length %s",
                            content_length,
                            self,
                        )
                        await self.sleep()
                        retries -= 1
                    else:
                        message = raw.decode("utf-8").strip()
                        break

        return message

    def _readline(self) -> Text:
        """ Read a line (or immediately return None)
        """
        try:
            return self.stream.readline().decode("utf-8").strip()
        except OSError:  # pragma: no cover
            return ""


class LspStdIoWriter(LspStdIoBase):
    """ Language Server stdio Writer
    """

    async def write(self):
        """ Write to a Language Server until it closes
        """
        while not self.stream.closed:
            message = await self.queue.get()
            try:
                body = message.encode("utf-8")
                response = "Content-Length: {}\r\n\r\n{}".format(len(body), message)
                self.stream.write(response.encode("utf-8"))
                self.stream.flush()
            except Exception:  # pragma: no cover
                self.log.exception("s couldn't write message: %s", self, response)
            finally:
                self.queue.task_done()
