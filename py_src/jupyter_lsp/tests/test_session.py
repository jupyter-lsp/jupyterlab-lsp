import asyncio

import pytest


@pytest.mark.asyncio
async def test_start(handler, jsonrpc_init_msg):
    """ will a process start if a handler starts listening?
    """
    manager = handler.manager
    manager.initialize()
    handler.open("python")
    session = handler.session
    assert session.process is not None

    handler.on_message(jsonrpc_init_msg)

    await asyncio.sleep(2)

    assert handler._messages_wrote

    handler.on_close()

    assert handler.session is None
    assert not session.handlers
