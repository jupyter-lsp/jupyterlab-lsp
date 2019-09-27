# import asyncio

from pytest import mark


@mark.asyncio
async def test_start(server_process, unused_tcp_port):
    proc = await server_process([f"--port={unused_tcp_port}"])
    assert proc.returncode is None
