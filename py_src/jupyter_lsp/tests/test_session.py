import asyncio

import pytest


@pytest.mark.asyncio
async def test_start(language, handler, jsonrpc_init_msg):
    """ will a process start if a handler starts listening?
    """
    manager = handler.manager
    manager.initialize()
    handler.open(language)
    session = handler.session
    assert session.process is not None

    handler.on_message(jsonrpc_init_msg)

    attempts_remaining = 10
    interval = 0.5

    while attempts_remaining:
        attempts_remaining -= 1
        await asyncio.sleep(interval)
        if handler._messages_wrote:
            break

    assert attempts_remaining, "failed to see any messages after {}s".format(
        attempts_remaining * interval
    )

    handler.on_close()

    assert handler.session is None
    assert not session.handlers
