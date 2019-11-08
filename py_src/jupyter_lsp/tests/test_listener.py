import asyncio

import pytest
from tornado.queues import Queue


@pytest.mark.asyncio
async def test_listeners(handlers, jsonrpc_init_msg):
    """ will a handler listener listen?
    """
    handler, ws_handler = handlers
    manager = handler.manager

    manager.initialize()

    handler_listened = Queue()
    server_listened = Queue()

    @manager.register_handler_listener(language=r".*", method=r".*")
    async def handler_listener(message, manager):
        await handler_listened.put(message)

    @manager.register_handler_listener(method=r"not-a-method")
    async def other_handler_listener(message, manager):  # pragma: no cover
        raise NotImplementedError("shouldn't get here")

    assert len(manager._handler_listeners) == 2

    @manager.register_session_listener(language=None, method=None)
    async def session_listener(message, manager):
        await server_listened.put(message)

    @manager.register_session_listener(language=r"not-a-language")
    async def other_session_listener(message, manager):  # pragma: no cover
        raise NotImplementedError("shouldn't get here")

    assert len(manager._session_listeners) == 2

    ws_handler.open("python")

    await ws_handler.on_message(jsonrpc_init_msg)

    try:
        await asyncio.wait_for(
            asyncio.gather(handler_listened.get(), server_listened.get()), 10
        )
        handler_listened.task_done()
        server_listened.task_done()
    finally:
        ws_handler.on_close()

    manager.unregister_handler_listener(handler_listener)
    manager.unregister_handler_listener(other_handler_listener)
    manager.unregister_session_listener(session_listener)
    manager.unregister_session_listener(other_session_listener)

    assert not manager._handler_listeners
    assert not manager._session_listeners
