import asyncio

import pytest


@pytest.mark.asyncio
async def test_start_known(known_language, handler, jsonrpc_init_msg):
    """ will a process start for a known language if a handler starts listening?
    """
    manager = handler.manager
    manager.initialize()
    handler.open(known_language)
    sessions = list(manager.sessions_for_handler(handler))
    session = sessions[0]
    assert session.process is not None

    handler.on_message(jsonrpc_init_msg)

    try:
        await asyncio.wait_for(handler._messages_wrote.get(), 20)
        handler._messages_wrote.task_done()
    finally:
        handler.on_close()

    assert not list(manager.sessions_for_handler(handler))
    assert not session.handlers
    assert not session.process


@pytest.mark.asyncio
async def test_start_unknown(known_unknown_language, handler, jsonrpc_init_msg):
    """ will a process not start for an unknown if a handler starts listening?
    """
    manager = handler.manager
    manager.initialize()
    handler.open(known_unknown_language)
    assert not list(manager.sessions_for_handler(handler))

    handler.on_message(jsonrpc_init_msg)

    handler.on_close()

    assert not list(manager.sessions_for_handler(handler))
