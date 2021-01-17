import json
import pathlib
import shutil
from typing import Text

from jupyter_server.serverapp import ServerApp
from pytest import fixture
from tornado.httputil import HTTPServerRequest
from tornado.queues import Queue
from tornado.web import Application

# local imports
from jupyter_lsp import LanguageServerManager
from jupyter_lsp.handlers import LanguageServersHandler, LanguageServerWebSocketHandler

# these should always be available in a test environment ()
KNOWN_SERVERS = [
    "bash-language-server",
    "dockerfile-language-server-nodejs",
    "javascript-typescript-langserver",
    "pyls",
    "unified-language-server",
    "sql-language-server",
    "vscode-css-languageserver-bin",
    "vscode-html-languageserver-bin",
    "vscode-json-languageserver-bin",
    "yaml-language-server",
]

CMD_BASED_SERVERS = {
    "Rscript": ["r-languageserver"],
    "texlab": ["texlab"],
    "jedi-language-server": ["jedi-language-server"],
    "julia": ["julia-language-server"],
}

KNOWN_SERVERS += sum(
    [langs for cmd, langs in CMD_BASED_SERVERS.items() if shutil.which(cmd)], []
)

KNOWN_UNKNOWN_SERVERS = ["foo-language-server"]


@fixture
def manager() -> LanguageServerManager:
    return LanguageServerManager()


@fixture(params=sorted(KNOWN_SERVERS))
def known_server(request):
    return request.param


@fixture(params=sorted(KNOWN_UNKNOWN_SERVERS))
def known_unknown_server(request):
    return request.param


@fixture
def handlers(manager):
    ws_handler = MockWebsocketHandler()
    ws_handler.initialize(manager)
    handler = MockHandler()
    handler.initialize(manager)
    return handler, ws_handler


@fixture
def jsonrpc_init_msg():
    return json.dumps(
        {
            "id": 0,
            "jsonrpc": "2.0",
            "method": "initialize",
            "params": {
                "capabilities": {
                    # LanguageServer.jl assumes that it is not missing
                    "workspace": {"didChangeConfiguration": {}}
                },
                "initializationOptions": None,
                "processId": None,
                "rootUri": pathlib.Path(__file__).parent.as_uri(),
                "workspaceFolders": None,
            },
        }
    )


@fixture
def app():
    return MockServerApp()


# mocks
class MockWebsocketHandler(LanguageServerWebSocketHandler):
    _messages_wrote = None  # type: Queue
    _ping_sent = None  # type: bool

    def __init__(self):
        self.request = HTTPServerRequest()
        self.application = Application()

    def initialize(self, manager):
        super().initialize(manager)
        self._messages_wrote = Queue()
        self._ping_sent = False

    def write_message(self, message: Text) -> None:
        self.log.warning("write_message %s", message)
        self._messages_wrote.put_nowait(message)

    def send_ping(self):
        self._ping_sent = True


class MockHandler(LanguageServersHandler):
    _payload = None

    def __init__(self):
        pass

    def finish(self, payload):
        self._payload = payload


class MockServerApp(ServerApp):
    pass
