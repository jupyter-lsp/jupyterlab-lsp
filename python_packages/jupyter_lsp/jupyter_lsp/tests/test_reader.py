import subprocess

import anyio
from anyio.streams.stapled import StapledObjectStream
import math
import pytest

from jupyter_lsp.connection import LspStreamReader
from jupyter_lsp.utils import get_unused_port

WRITER_TEMPLATE = """
from time import sleep

# the LSP states that each header field must be terminated by \\r\\n
print('Content-Length: {length}', end='\\r\\n')
# and the header must be terminated again by \\r\\n
print(end='\\r\\n')

for repeat in range({repeats}):
    sleep({interval})
    print('{message}', end='')

if {add_excess}:
    print("extra", end='')

print()
"""

TCP_WRITER_TEMPLATE = """
from anyio import create_tcp_listener, create_task_group, run, sleep, Event

async def serve_once(listener):
    async def handle(client):
        async with client:
            # the LSP states that each header field must be terminated by \\r\\n
            await client.send(b'Content-Length: {length}\\r\\n')
            # and the header must be terminated again by \\r\\n
            await client.send(b'\\r\\n')

            for repeat in range({repeats}):
                await sleep({interval})
                await client.send(b'{message}')

            if {add_excess}:
                await client.send(b"extra")

            await client.send(b'\\n')

            stop.set()

    async def cancel_on_event(scope):
        await stop.wait()
        scope.cancel()

    stop = Event()
    async with create_task_group() as tg:
        tg.start_soon(listener.serve, handle)
        tg.start_soon(cancel_on_event, tg.cancel_scope)

async def main():
    listener = await create_tcp_listener(local_port={port})
    await serve_once(listener)

run(main)
"""


class CommunicatorSpawner:
    def __init__(self, tmp_path):
        self.tmp_path = tmp_path

    async def spawn_writer(
        self, message: str, repeats: int = 1, interval=None, add_excess=False, port=None
    ):
        template = WRITER_TEMPLATE if port is None else TCP_WRITER_TEMPLATE
        length = len(message) * repeats
        commands_file = self.tmp_path / "writer.py"
        commands_file.write_text(
            template.format(
                length=length,
                repeats=repeats,
                interval=interval or 0,
                message=message,
                add_excess=add_excess,
                port=port,
            )
        )
        return await anyio.open_process(
            ["python", "-u", str(commands_file)], stdout=subprocess.PIPE
        )


@pytest.fixture
def communicator_spawner(tmp_path):
    return CommunicatorSpawner(tmp_path)


async def join_process(process: anyio.abc.Process, headstart=1, timeout=1):
    await anyio.sleep(headstart)
    # wait for timeout second for the process to terminate before raising a TimeoutError
    with anyio.fail_after(timeout):
        result = await process.wait()
    # close any streams attached to stdout
    if process.stdout:
        await process.stdout.aclose()
    return result


@pytest.mark.parametrize(
    "message,repeats,interval,add_excess",
    [
        ["short", 1, None, False],
        ["ab" * 100_000, 1, None, False],
        ["ab", 2, 0.01, False],
        ["ab", 45, 0.01, False],
        ["message", 2, 0.01, True],
    ],
    ids=[
        "short",
        "long",
        "intermittent",
        "intensive-intermittent",
        "with-excess",
    ],
)
@pytest.mark.parametrize("mode", ["stdio", "tcp"], ids=["stdio", "tcp"])
@pytest.mark.anyio
async def test_reader(
    message, repeats, interval, add_excess, mode, communicator_spawner
):
    queue = StapledObjectStream(
        *anyio.create_memory_object_stream(max_buffer_size=math.inf))

    port = get_unused_port() if mode == "tcp" else None
    process = await communicator_spawner.spawn_writer(
        message=message,
        repeats=repeats,
        interval=interval,
        add_excess=add_excess,
        port=port,
    )
    stream = None
    if port is None:
        stream = process.stdout
    else:
        # give the server some time to start
        await anyio.sleep(2)
        stream = await anyio.connect_tcp("127.0.0.1", port)

    reader = LspStreamReader(stream=stream, queue=queue)

    async with anyio.create_task_group() as tg:
        tg.start_soon(join_process, process, 3, 1)
        tg.start_soon(reader.read)

    if port is not None:
        await stream.aclose()

    result = await queue.receive()
    assert result == message * repeats
