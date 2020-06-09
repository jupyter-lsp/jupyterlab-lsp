import asyncio

import pytest

from ..schema import SERVERS_RESPONSE


@pytest.mark.asyncio
async def test_start_known(known_server, lsp_handler, jsonrpc_init_msg):
    """ will a process start for a known server if a handler starts?
    """
    manager = lsp_handler.manager

    manager.initialize()

    assert_status_set(manager, {"not_started"})

    lsp_handler.open(known_server)
    session = manager.sessions[lsp_handler.language_server]
    assert session.process is not None

    assert_status_set(manager, {"started"}, known_server)

    await lsp_handler.on_message(jsonrpc_init_msg)

    try:
        await asyncio.wait_for(lsp_handler._messages_wrote.get(), 20)
        lsp_handler._messages_wrote.task_done()
    finally:
        lsp_handler.on_close()

    assert not session.handlers
    assert not session.process

    assert_status_set(manager, {"stopped"}, known_server)
    assert_status_set(manager, {"stopped", "not_started"})


@pytest.mark.asyncio
async def test_start_unknown(known_unknown_server, lsp_handler, jsonrpc_init_msg):
    """ will a process not start for an unknown server if a handler starts?
    """
    manager = lsp_handler.manager
    manager.initialize()

    assert_status_set(manager, {"not_started"})

    lsp_handler.open(known_unknown_server)

    assert_status_set(manager, {"not_started"})

    await lsp_handler.on_message(jsonrpc_init_msg)
    assert_status_set(manager, {"not_started"})
    lsp_handler.on_close()

    assert not manager.sessions.get(lsp_handler.language_server)
    assert_status_set(manager, {"not_started"})


# utilities
def assert_status_set(manager, expected_statuses, language_server=None):
    payload = manager.get_status_response()

    errors = list(SERVERS_RESPONSE.iter_errors(payload))
    assert not errors, [err.path for err in errors]

    statuses = {
        session["status"]
        for session_server, session in payload["sessions"].items()
        if language_server is None or language_server == session_server
    }
    assert statuses == expected_statuses, payload
