import asyncio

import pytest

from .conftest import SERVERS_SCHEMA


def assert_status_set(handler, expected_statuses, language=None):
    handler.get()
    payload = handler._payload

    SERVERS_SCHEMA.validate(payload)

    statuses = {
        s["status"]
        for s in payload["sessions"]
        if language is None or language in s["languages"]
    }
    assert statuses == expected_statuses


@pytest.mark.asyncio
async def test_start_known(known_language, handlers, jsonrpc_init_msg):
    """ will a process start for a known language if a handler starts listening?
    """
    handler, ws_handler = handlers
    manager = handler.manager

    manager.initialize()

    assert_status_set(handler, {"not_started"})

    ws_handler.open(known_language)
    sessions = list(manager.sessions_for_handler(ws_handler))
    session = sessions[0]
    assert session.process is not None

    assert_status_set(handler, {"started"}, known_language)

    ws_handler.on_message(jsonrpc_init_msg)

    try:
        await asyncio.wait_for(ws_handler._messages_wrote.get(), 20)
        ws_handler._messages_wrote.task_done()
    finally:
        ws_handler.on_close()

    assert not list(manager.sessions_for_handler(ws_handler))
    assert not session.handlers
    assert not session.process

    assert_status_set(handler, {"stopped"}, known_language)
    assert_status_set(handler, {"stopped", "not_started"})


@pytest.mark.asyncio
async def test_start_unknown(known_unknown_language, handlers, jsonrpc_init_msg):
    """ will a process not start for an unknown if a handler starts listening?
    """
    handler, ws_handler = handlers
    manager = handler.manager
    manager.initialize()
    ws_handler.open(known_unknown_language)
    assert not list(manager.sessions_for_handler(ws_handler))

    ws_handler.on_message(jsonrpc_init_msg)

    ws_handler.on_close()

    assert not list(manager.sessions_for_handler(ws_handler))
