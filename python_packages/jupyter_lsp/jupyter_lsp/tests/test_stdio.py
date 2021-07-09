import subprocess

import anyio
import pytest
from tornado.queues import Queue

from jupyter_lsp.connection import LspStreamReader

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


class CommunicatorSpawner:
    def __init__(self, tmp_path):
        self.tmp_path = tmp_path

    async def spawn_writer(
        self, message: str, repeats: int = 1, interval=None, add_excess=False
    ):
        length = len(message) * repeats
        commands_file = self.tmp_path / "writer.py"
        commands_file.write_text(
            WRITER_TEMPLATE.format(
                length=length,
                repeats=repeats,
                interval=interval or 0,
                message=message,
                add_excess=add_excess,
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
    ids=["short", "long", "intermittent", "intensive-intermittent", "with-excess"],
)
@pytest.mark.anyio
async def test_reader(message, repeats, interval, add_excess, communicator_spawner):
    queue = Queue()

    process = await communicator_spawner.spawn_writer(
        message=message, repeats=repeats, interval=interval, add_excess=add_excess
    )
    reader = LspStreamReader(stream=process.stdout, queue=queue)

    async with anyio.create_task_group() as tg:
        tg.start_soon(join_process, process, 3, 1)
        tg.start_soon(reader.read)

    result = queue.get_nowait()
    assert result == message * repeats
