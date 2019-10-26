""" get a randome port
"""
import socket


def get_unused_port(self):
    """ Get an unused port by trying to listin to any random port, then stop.

        Probably could introduce race conditions if inside a tight loop.
    """
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(("localhost", 0))
    sock.listen(1)
    port = sock.getsockname()[1]
    sock.close()
    return port
