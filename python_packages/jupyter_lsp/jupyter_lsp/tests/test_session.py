import asyncio
import logging
import subprocess

import pytest

from ..handlers import LanguageServerWebSocketHandler
from ..schema import SERVERS_RESPONSE
from ..session import LanguageServerSession


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
        await asyncio.wait_for(
            ws_handler._messages_wrote.get(),
            120 if known_server == "julia-language-server" else 20,
        )
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


@pytest.mark.asyncio
async def test_ping(handlers):
    """see https://github.com/krassowski/jupyterlab-lsp/issues/458"""
    a_server = "pyls"

    handler, ws_handler = handlers
    manager = handler.manager

    manager.initialize()

    assert ws_handler.ping_interval > 0
    # the default ping interval is 30 seconds, too long for a test
    ws_handler.settings["ws_ping_interval"] = 0.1
    assert ws_handler.ping_interval == 0.1

    assert ws_handler._ping_sent is False

    ws_handler.open(a_server)

    assert ws_handler.ping_callback is not None and ws_handler.ping_callback.is_running
    await asyncio.sleep(ws_handler.ping_interval * 3)

    assert ws_handler._ping_sent is True

    ws_handler.on_close()


@pytest.mark.asyncio
async def test_broken_pipe(handlers, jsonrpc_init_msg, did_open_message, caplog):
    """If the pipe breaks (server dies), can we recover by restarting the server?"""
    a_server = "pyls"

    # use real handler in this test rather than a mock
    # -> testing broken pipe requires that here
    handler, ws_handler = handlers
    manager = handler.manager

    manager.initialize()

    assert_status_set(handler, {"not_started"}, a_server)

    ws_handler.open(a_server)

    await ws_handler.on_message(jsonrpc_init_msg)
    assert_status_set(handler, {"started"}, a_server)

    session: LanguageServerSession = manager.sessions[a_server]
    process: subprocess.Popen = session.process
    process.kill()

    with caplog.at_level(logging.WARNING):
        # an attempt to write should raise BrokenPipeError
        await ws_handler.on_message(did_open_message)
        await asyncio.sleep(1)

        # which should be caught
        assert "Encountered pyls language server failure" in caplog.text
        assert "exception: [Errno 32] Broken pipe" in caplog.text

        # and the server should get restarted
        assert "restarting session..." in caplog.text

    assert_status_set(handler, {"started"}, a_server)

    with caplog.at_level(logging.WARNING):
        # we should be able to send a message now
        await ws_handler.on_message(did_open_message)
        assert caplog.text == ""

    ws_handler.on_close()
