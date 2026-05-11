import asyncio
import io
import subprocess
import sys
from typing import Optional

import pytest

from jupyter_lsp.stdio import LspStdIoReader

WRITER_TEMPLATE = """
from time import sleep

print('Content-Length: {length}')
print()

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

    def spawn_writer(
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
        return subprocess.Popen(
            [sys.executable, "-u", str(commands_file)],
            stdout=subprocess.PIPE,
            bufsize=0,
        )


@pytest.fixture
def communicator_spawner(tmp_path):
    return CommunicatorSpawner(tmp_path)


async def join_process(process: subprocess.Popen, headstart=1, timeout=1):
    await asyncio.sleep(headstart)
    result = process.wait(timeout=timeout)
    return result


@pytest.mark.parametrize(
    "message,repeats,interval,add_excess",
    [
        ["short", 1, None, False],
        ["ab" * 10_0000, 1, None, False],
        ["ab", 2, 0.01, False],
        ["ab", 45, 0.01, False],
        ["message", 2, 0.01, True],
    ],
    ids=["short", "long", "intermittent", "intensive-intermittent", "with-excess"],
)
@pytest.mark.asyncio
async def test_reader(message, repeats, interval, add_excess, communicator_spawner):
    queue = asyncio.Queue()

    process = communicator_spawner.spawn_writer(
        message=message, repeats=repeats, interval=interval, add_excess=add_excess
    )
    reader = LspStdIoReader(stream=process.stdout, queue=queue)

    try:
        await asyncio.gather(join_process(process, headstart=3, timeout=1), reader.read())
    finally:
        process.stdout.close()

    result = queue.get_nowait()
    assert result == message * repeats


class _BytesStream(io.RawIOBase):
    """Synchronous stream backed by a bytes buffer — returns b'' at EOF."""

    def __init__(self, data: bytes):
        self._buf = io.BytesIO(data)

    def read(self, n=-1):
        return self._buf.read(n)

    def readline(self, size: Optional[int] = -1):
        return self._buf.readline(size)

    def readable(self):
        return True


@pytest.mark.asyncio
async def test_read_content_eof_before_full_length():
    """_read_content returns None when EOF arrives before content-length bytes."""
    stream = _BytesStream(b"partial")  # 7 bytes, but we ask for 100
    reader = LspStdIoReader(stream=stream, queue=asyncio.Queue())
    result = await reader._read_content(length=100)
    assert result is None


@pytest.mark.asyncio
async def test_read_one_returns_none_on_truncated_content():
    """read_one returns None when the process exits before sending all content."""
    data = b"Content-Length: 100\r\n\r\nhello"  # claims 100 bytes, sends 5 then EOF
    stream = _BytesStream(data)
    reader = LspStdIoReader(stream=stream, queue=asyncio.Queue())
    result = await reader.read_one()
    assert result is None


@pytest.mark.asyncio
async def test_read_one_returns_none_on_immediate_eof():
    """read_one returns None when the stream is already at EOF."""
    stream = _BytesStream(b"")
    reader = LspStdIoReader(stream=stream, queue=asyncio.Queue())
    result = await reader.read_one()
    assert result is None
