""" get a random port
"""
import socket


def get_unused_port():
    """Get an unused port by trying to listen to any random port.

    Probably could introduce race conditions if inside a tight loop.
    """
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(("localhost", 0))
    sock.listen(1)
    port = sock.getsockname()[1]
    sock.close()
    return port
