import json
import pathlib
from typing import Text

from notebook.notebookapp import NotebookApp
from pytest import fixture

from .. import LanguageServerManager
from ..handlers import LanguageServerWebSocketHandler

KNOWN_LANGUAGES = [
    "css",
    "html",
    "javascript",
    "json",
    "less",
    "python",
    "scss",
    "typescript",
    "yaml",
]


@fixture
def manager() -> LanguageServerManager:
    return LanguageServerManager()


@fixture(params=KNOWN_LANGUAGES)
def language(request):
    return request.param


@fixture
def handler(manager):
    handler = MockWebsocketHandler()
    handler.initialize(manager)
    return handler


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
    _messages_wrote = None

    def __init__(self):
        pass

    def initialize(self, manager):
        super().initialize(manager)
        self._messages_wrote = []

    def write_message(self, message: Text) -> None:
        self._messages_wrote += [message]


class MockNotebookApp(NotebookApp):
    pass
