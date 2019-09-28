from typing import Text

from pytest import fixture

from .. import LanguageServerManager
from ..handlers import LanguageServerWebSocketHandler


@fixture
def manager() -> LanguageServerManager:
    return LanguageServerManager()


@fixture(params=[None, []])
def falsy_pyls(request):
    return request.param


@fixture
def handler(manager):
    handler = MockWebsocketHandler()
    handler.initialize(manager)
    return handler


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
