import asyncio

import pytest

from ..schema import SERVERS_RESPONSE


def assert_status_set(handler, expected_statuses, language_server=None):
    handler.get()
    payload = handler._payload

    errors = list(SERVERS_RESPONSE.iter_errors(payload))
    assert not errors

    statuses = {
        session["status"]
        for session_server, session in payload["sessions"].items()
        if language_server is None or language_server == session_server
    }
    assert statuses == expected_statuses, payload


@pytest.mark.asyncio
async def test_start_known(known_server, handlers, jsonrpc_init_msg):
    """will a process start for a known server if a handler starts?"""
    handler, ws_handler = handlers
    manager = handler.manager

    manager.initialize()

    assert_status_set(handler, {"not_started"})

    ws_handler.open(known_server)
    session = manager.sessions[ws_handler.language_server]
    assert session.process is not None

    assert_status_set(handler, {"started"}, known_server)

    await ws_handler.on_message(jsonrpc_init_msg)

    try:
        await asyncio.wait_for(ws_handler._messages_wrote.get(), 20)
        ws_handler._messages_wrote.task_done()
    finally:
        ws_handler.on_close()

    assert not session.handlers
    assert not session.process

    assert_status_set(handler, {"stopped"}, known_server)
    assert_status_set(handler, {"stopped", "not_started"})


@pytest.mark.asyncio
async def test_start_unknown(known_unknown_server, handlers, jsonrpc_init_msg):
    """will a process not start for an unknown server if a handler starts?"""
    handler, ws_handler = handlers
    manager = handler.manager
    manager.initialize()

    assert_status_set(handler, {"not_started"})

    ws_handler.open(known_unknown_server)

    assert_status_set(handler, {"not_started"})

    await ws_handler.on_message(jsonrpc_init_msg)
    assert_status_set(handler, {"not_started"})
    ws_handler.on_close()

    assert not manager.sessions.get(ws_handler.language_server)
    assert_status_set(handler, {"not_started"})
