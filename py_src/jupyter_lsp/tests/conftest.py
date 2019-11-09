import json
import pathlib
import shutil
from typing import Text

from notebook.notebookapp import NotebookApp
from pytest import fixture
from tornado.queues import Queue

# local imports
from jupyter_lsp import LanguageServerManager
from jupyter_lsp.handlers import LanguageServersHandler, LanguageServerWebSocketHandler

# these should always be available in a test environment ()
KNOWN_LANGUAGES = [
    "bash",
    "css",
    "dockerfile",
    "html",
    "ipythongfm",
    "javascript",
    "json",
    "jsx",
    "less",
    "markdown",
    "python",
    "scss",
    "typescript-jsx",
    "typescript",
    "yaml",
]

CMD_BASED_LANGUAGES = {"Rscript": ["r"]}

KNOWN_LANGUAGES += sum(
    [langs for cmd, langs in CMD_BASED_LANGUAGES.items() if shutil.which(cmd)], []
)

KNOWN_UNKNOWN_LANGUAGES = ["cobol"]


@fixture
def manager() -> LanguageServerManager:
    return LanguageServerManager()


@fixture(params=sorted(KNOWN_LANGUAGES))
def known_language(request):
    return request.param


@fixture(params=sorted(KNOWN_UNKNOWN_LANGUAGES))
def known_unknown_language(request):
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
                "capabilities": {},
                "initializationOptions": None,
                "processId": None,
                "rootUri": pathlib.Path(__file__).parent.as_uri(),
                "workspaceFolders": None,
            },
        }
    )


@fixture
def app():
    return MockNotebookApp()


# mocks
class MockWebsocketHandler(LanguageServerWebSocketHandler):
    _messages_wrote = None  # type: Queue

    def __init__(self):
        pass

    def initialize(self, manager):
        super().initialize(manager)
        self._messages_wrote = Queue()

    def write_message(self, message: Text) -> None:
        self.log.warning("write_message %s", message)
        self._messages_wrote.put_nowait(message)


class MockHandler(LanguageServersHandler):
    _payload = None

    def __init__(self):
        pass

    def finish(self, payload):
        self._payload = payload


class MockNotebookApp(NotebookApp):
    pass
