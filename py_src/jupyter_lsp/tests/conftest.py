import asyncio
from typing import List, Text

from pytest import fixture

from .. import ConnectorCommands, LanguageServerApp


@fixture
def arg_language_servers():
    def _arg(language_servers: ConnectorCommands) -> List[Text]:
        args = ["--LanguageServerApp.language_servers={}".format(language_servers)]
        return args

    return _arg


@fixture
def server() -> LanguageServerApp:
    return LanguageServerApp()


@fixture
def debug_server(server) -> LanguageServerApp:
    server.initialize(["--debug"])
    return server


@fixture(params=[None, []])
def falsy_pyls(request):
    return request.param


@fixture
async def server_process():
    servers = []

    async def _make_server(argv):
        server = await asyncio.create_subprocess_exec(
            "jupyter-lsproxy", *argv, stdout=asyncio.subprocess.PIPE
        )
        servers.append(server)
        return server

    yield _make_server

    for server in servers:
        server.terminate()
        await server.wait()
