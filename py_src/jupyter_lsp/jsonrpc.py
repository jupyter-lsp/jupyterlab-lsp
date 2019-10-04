""" Custom subclasses of python-jsonrpc-server components

Parts of this code are derived from:

> https://github.com/palantir/python-jsonrpc-server/blob/0.2.0/pyls_jsonrpc/streams.py#L83   # noqa
> > MIT License   https://github.com/palantir/python-jsonrpc-server/blob/0.2.0/LICENSE
> > Copyright 2018 Palantir Technologies, Inc.
"""

import json

from pyls_jsonrpc.streams import JsonRpcStreamReader, JsonRpcStreamWriter, log


class Reader(JsonRpcStreamReader):
    """ Custom subclass of reader. Doesn't do much yet.
    """

    pass


class Writer(JsonRpcStreamWriter):
    """ Custom subclass for writer. Handles some inconsistencies vs the spec

        TODO: propose upstream change (with tests)
    """

    def write(self, message):  # pragma: no cover
        with self._wfile_lock:
            if self._wfile.closed:
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
            except Exception:  # pylint: disable=broad-except
                log.exception("Failed to write message to output file %s", message)
