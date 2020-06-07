import json
import pathlib
import shutil
from typing import Any, Text

from pytest import fixture
from tornado.queues import Queue

# local imports
from jupyter_lsp import LanguageServerManager
from jupyter_lsp.handlers import LanguageServersHandler, LanguageServerWebSocketHandler
from jupyter_lsp.kernel.handlers import CommHandler
from jupyter_lsp.kernel.kernel import LanguageServerKernel
from jupyter_lsp.kernel.manager import CommLanguageServerManager
from jupyter_lsp.types import LanguageServerManagerAPI

# these should always be available in a test environment ()
KNOWN_SERVERS = [
    "bash-language-server",
    "vscode-css-languageserver-bin",
    "dockerfile-language-server-nodejs",
    "vscode-html-languageserver-bin",
    "unified-language-server",
    "javascript-typescript-langserver",
    "vscode-json-languageserver-bin",
    "pyls",
    "yaml-language-server",
]

CMD_BASED_SERVERS = {"Rscript": ["r-languageserver"]}

KNOWN_SERVERS += sum(
    [langs for cmd, langs in CMD_BASED_SERVERS.items() if shutil.which(cmd)], []
)

KNOWN_UNKNOWN_SERVERS = ["foo-language-server"]


@fixture(params=[CommLanguageServerManager])
def manager(request) -> LanguageServerManagerAPI:
    kwargs = {}  # type: Any
    if request.param == CommLanguageServerManager:
        kernel = MockKernel()
        kwargs.update(parent=kernel)
    return request.param(**kwargs)


@fixture(params=sorted(KNOWN_SERVERS))
def known_server(request):
    return request.param


@fixture(params=sorted(KNOWN_UNKNOWN_SERVERS))
def known_unknown_server(request):
    return request.param


@fixture
def handlers(manager):
    if isinstance(manager, CommLanguageServerManager):
        ws_handler = MockCommHandler()
        ws_handler.comm = MockComm()
    else:
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
                "capabilities": {},
                "initializationOptions": None,
                "processId": None,
                "rootUri": pathlib.Path(__file__).parent.as_uri(),
                "workspaceFolders": None,
            },
        }
    )


@fixture
def mock_comm():
    return MockComm()


# mocks
class MockClientMixin:
    _messages_wrote = None  # type: Queue

    def initialize(self, manager, *args, **kwargs):
        super().initialize(manager, *args, **kwargs)
        self._messages_wrote = Queue()

    def write_message(self, message: Text) -> None:
        getattr(self, "log").warning("write_message %s", message)
        self._messages_wrote.put_nowait(message)


class MockWebsocketHandler(MockClientMixin, LanguageServerWebSocketHandler):
    def __init__(self):
        pass


class MockCommHandler(MockClientMixin, CommHandler):
    pass


class MockHandler(LanguageServersHandler):
    _payload = None

    def __init__(self):
        pass

    def finish(self, payload):
        self._payload = payload


class MockNotebookApp(NotebookApp):
    pass


class MockKernel(LanguageServerKernel):
    pass


class MockComm:
    def on_msg(self, fn):
        self._fn = fn

    def send(self, msg):
        self._sent = getattr(self, "_sent", []) + [msg]
