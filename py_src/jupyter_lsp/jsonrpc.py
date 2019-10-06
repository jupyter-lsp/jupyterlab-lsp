""" Custom subclasses of python-jsonrpc-server components

Parts of this code are derived from:

> https://github.com/palantir/python-jsonrpc-server/blob/0.2.0/pyls_jsonrpc/streams.py#L83   # noqa
> https://github.com/palantir/python-jsonrpc-server/blob/45ed1931e4b2e5100cc61b3992c16d6f68af2e80/pyls_jsonrpc/streams.py  # noqa
> > MIT License   https://github.com/palantir/python-jsonrpc-server/blob/0.2.0/LICENSE
> > Copyright 2018 Palantir Technologies, Inc.
"""
# pylint: disable=broad-except

import json

from pyls_jsonrpc.streams import JsonRpcStreamReader, JsonRpcStreamWriter, log


class Reader(JsonRpcStreamReader):
    """ Custom subclass of reader. Doesn't do much yet.
    """

    def listen(self, message_consumer):
        """Blocking call to listen for messages on the rfile.
        Args:
            message_consumer (fn): function that is passed each message as it is
            read off the socket.
        """
        while not self._rfile.closed:
            request_str = self._read_message()
            log.warning("read request %s", request_str)

            if request_str is None:
                break

            # to check for windows line endings
            if request_str == "\r\n":  # pragma: no cover
                break

            try:
                message_consumer(json.loads(request_str.decode("utf-8")))
            except ValueError:  # pragma: no cover
                log.exception("Failed to parse JSON message %s", request_str)
                continue

    def _read_message(self):
        """Reads the contents of a message.
        Returns:
            body of message if parsable else None
        """
        i = 0
        line = self._rfile.readline()
        log.warning("read line %s %s", i, line)

        if not line:
            return None

        content_length = self._content_length(line)
        log.warning("read content length %s", content_length)

        # Blindly consume all header lines
        while line and line.strip():
            i += 1
            log.warning("read line %s %s", i, line)
            line = self._rfile.readline()

        if not line:
            return None

        # Grab the body
        return self._rfile.read(content_length)


class Writer(JsonRpcStreamWriter):
    """ Custom subclass for writer. Handles some inconsistencies vs the spec

        TODO: propose upstream change (with tests)
    """

    def write(self, message):
        with self._wfile_lock:
            if self._wfile.closed:  # pragma: no cover
                return
            try:
                body = json.dumps(message, **self._json_dumps_args)

                # Ensure we get the byte length, not the character length
                content_length = (
                    len(body) if isinstance(body, bytes) else len(body.encode("utf-8"))
                )

                response = "Content-Length: {}\r\n\r\n" "{}".format(
                    content_length, body
                )

                self._wfile.write(response.encode("utf-8"))
                self._wfile.flush()
            except Exception:  # pragma: no cover
                log.exception("Failed to write message to output file %s", message)
