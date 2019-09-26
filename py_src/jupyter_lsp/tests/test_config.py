from typing import Any, List, Text

from pytest import fixture, mark

from jupyter_lsp import ConnectorCommands, LanguageServerApp


def arg_language_servers(language_servers: ConnectorCommands) -> List[Text]:
    args = ["--LanguageServerApp.language_servers={}".format(language_servers)]
    return args


@fixture
def server() -> LanguageServerApp:
    return LanguageServerApp()


@fixture
def debug_server(server: LanguageServerApp) -> LanguageServerApp:
    server.initialize(["--debug"])
    return server


@mark.parametrize("pyls", [None, []])
def test_config_cli(server: LanguageServerApp, pyls: Any) -> None:
    """ Ensure falsey values clobber autodetection
    """
    assert not server.language_servers
    server.initialize(arg_language_servers({"python": pyls}))
    assert "python" not in server.language_servers
