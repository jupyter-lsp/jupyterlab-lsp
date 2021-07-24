import asyncio
import os

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
    a_server = "pylsp"

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


def exists_process_with_pid(pid):
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    else:
        return True


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "timeout", [0, 5], ids=["terminate immediately", "after 5 seconds"]
)
async def test_stop(handlers, timeout):
    """Test whether process will stop gracefully or forcefully"""
    a_server = "pylsp"

    handler, ws_handler = handlers
    manager = handler.manager

    manager.initialize()

    ws_handler.open(a_server)

    session = manager.sessions[ws_handler.language_server]
    session.stop_timeout = timeout

    process_pid = session.process.pid
    assert exists_process_with_pid(process_pid) is True

    ws_handler.on_close()

    await asyncio.sleep(timeout + 1)
    assert exists_process_with_pid(process_pid) is False
