"""Integration tests of authorization running under jupyter-server."""
import json
import os
import socket
import subprocess
import time
import uuid
from typing import Generator, Tuple
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

import pytest

from .conftest import KNOWN_SERVERS

LOCALHOST = "127.0.0.1"
REST_ROUTES = ["/lsp/status"]
WS_ROUTES = [f"/lsp/ws/{ls}" for ls in KNOWN_SERVERS]


@pytest.mark.parametrize("route", REST_ROUTES)
def test_auth_rest(route: str, a_server_url_and_token: Tuple[str, str]) -> None:
    """Verify a REST route only provides access to an authenticated user."""
    base_url, token = a_server_url_and_token

    verify_response(base_url, route)

    url = f"{base_url}{route}"

    with urlopen(f"{url}?token={token}") as response:
        raw_body = response.read().decode("utf-8")

    decode_error = None

    try:
        json.loads(raw_body)
    except json.decoder.JSONDecodeError as err:
        decode_error = err
    assert not decode_error, f"the response for {url} was not JSON"


@pytest.mark.parametrize("route", WS_ROUTES)
def test_auth_websocket(route: str, a_server_url_and_token: Tuple[str, str]) -> None:
    """Verify a WebSocket does not provide access to an unauthenticated user."""
    verify_response(a_server_url_and_token[0], route)


@pytest.fixture(scope="module")
def a_server_url_and_token(
    tmp_path_factory: pytest.TempPathFactory,
) -> Generator[Tuple[str, str], None, None]:
    """Start a temporary, isolated jupyter server."""
    token = str(uuid.uuid4())
    port = get_unused_port()

    root_dir = tmp_path_factory.mktemp("root_dir")
    home = tmp_path_factory.mktemp("home")
    server_conf = home / "etc/jupyter/jupyter_config.json"

    server_conf.parent.mkdir(parents=True)
    extensions = {"jupyter_lsp": True, "jupyterlab": False, "nbclassic": False}
    app = {"jpserver_extensions": extensions, "token": token}
    config_data = {"ServerApp": app, "IdentityProvider": {"token": token}}

    server_conf.write_text(json.dumps(config_data), encoding="utf-8")
    args = ["jupyter-server", f"--port={port}", "--no-browser"]
    env = dict(os.environ)
    env.update(
        HOME=str(home),
        USERPROFILE=str(home),
        JUPYTER_CONFIG_DIR=str(server_conf.parent),
    )
    proc = subprocess.Popen(args, cwd=str(root_dir), env=env, stdin=subprocess.PIPE)
    url = f"http://{LOCALHOST}:{port}"
    retries = 20
    while retries:
        time.sleep(1)
        try:
            urlopen(f"{url}/favicon.ico")
            break
        except URLError:
            print(f"[{retries} / 20] ...", flush=True)
            retries -= 1
            continue
    yield url, token
    proc.terminate()
    proc.communicate(b"y\n")
    proc.wait()
    assert proc.returncode is not None, "jupyter-server probably still running"


def get_unused_port():
    """Get an unused port by trying to listen to any random port.

    Probably could introduce race conditions if inside a tight loop.
    """
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind((LOCALHOST, 0))
    sock.listen(1)
    port = sock.getsockname()[1]
    sock.close()
    return port


def verify_response(base_url: str, route: str, expect: int = 403):
    """Verify that a response returns the expected error."""
    error = None
    body = None
    url = f"{base_url}{route}"
    try:
        with urlopen(url) as res:
            body = res.read()
    except HTTPError as err:
        error = err
    assert error, f"no HTTP error for {url}: {body}"
    http_code = error.getcode()
    assert http_code == expect, f"{url} HTTP code was unexpected: {body}"
