import asyncio
import subprocess
import time
from threading import Thread

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
        commands_file.write(
            WRITER_TEMPLATE.format(
                length=length, repeats=repeats, interval=interval or 0, message=message
            )
        )
        return subprocess.Popen(
            ["python", "-u", str(commands_file)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
        )


@pytest.fixture
def communicator_spawner(tmp_path):
    return CommunicatorSpawner(tmp_path)


def communicate_and_close(process, wait=1):
    def communicate_and_close():
        time.sleep(wait)
        process.communicate()

    thread = Thread(target=communicate_and_close)
    thread.start()


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
    timeout = 2 + (interval or 1) * repeats * 10

    communicate_and_close(process)
    await asyncio.wait_for(reader.read(), timeout=timeout)

    result = queue.get_nowait()
    assert result == message * repeats
