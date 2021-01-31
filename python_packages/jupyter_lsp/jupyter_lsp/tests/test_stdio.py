import asyncio
import subprocess

import pytest
from tornado.queues import Queue

from jupyter_lsp.stdio import LspStdIoReader

WRITER_TEMPLATE = """
from time import sleep

print('Content-Length: {length}')
print()

for repeat in range({repeats}):
    sleep({interval})
    print('{message}', end='')
print()
"""


class CommunicatorSpawner:
    def __init__(self, tmp_path):
        self.tmp_path = tmp_path

    def spawn_writer(self, message: str, repeats: int = 1, interval=None):
        length = len(message) * repeats
        commands_file = self.tmp_path / "writer.py"
        commands_file.write_text(
            WRITER_TEMPLATE.format(
                length=length, repeats=repeats, interval=interval or 0, message=message
            )
        )
        return subprocess.Popen(
            ["python", "-u", str(commands_file)], stdout=subprocess.PIPE
        )


@pytest.fixture
def communicator_spawner(tmp_path):
    return CommunicatorSpawner(tmp_path)


async def join_process(process: subprocess.Popen, headstart=1, timeout=1):
    await asyncio.sleep(headstart)
    result = process.wait(timeout=timeout)
    if process.stdout:
        process.stdout.close()
    return result


@pytest.mark.parametrize(
    "message,repeats,interval",
    [
        ["short", 1, None],
        ["ab" * 10_0000, 1, None],
        ["ab", 2, 0.01],
        ["ab", 45, 0.01],
    ],
    ids=["short", "long", "intermittent", "intensive-intermittent"],
)
@pytest.mark.asyncio
async def test_reader(message, repeats, interval, communicator_spawner):
    queue = Queue()

    process = communicator_spawner.spawn_writer(
        message=message, repeats=repeats, interval=interval
    )
    reader = LspStdIoReader(stream=process.stdout, queue=queue)

    await asyncio.gather(join_process(process, headstart=3, timeout=1), reader.read())

    result = queue.get_nowait()
    assert result == message * repeats
