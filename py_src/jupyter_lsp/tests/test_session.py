import asyncio

import pytest


@pytest.mark.asyncio
async def test_start_known(known_language, handler, jsonrpc_init_msg):
    """ will a process start for a known language if a handler starts listening?
    """
    manager = handler.manager
    manager.initialize()
    handler.open(known_language)
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


@pytest.mark.asyncio
async def test_start(known_unknown_language, handler, jsonrpc_init_msg):
    """ will a process not start for an unknown if a handler starts listening?
    """
    manager = handler.manager
    manager.initialize()
    handler.open(known_unknown_language)
    assert handler.session is None

    handler.on_message(jsonrpc_init_msg)

    handler.on_close()

    assert handler.session is None
