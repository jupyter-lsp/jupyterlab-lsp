from pathlib import Path
from typing import List

import pytest

from ..virtual_documents_shadow import setup_shadow_filesystem, extract_or_none


def test_extract_or_none():
    obj = {'nested': {'value': 1}}
    assert extract_or_none(obj, ['nested']) == {'value': 1}
    assert extract_or_none(obj, ['nested', 'value']) == 1
    assert extract_or_none(obj, ['missing', 'value']) is None


def did_open(uri, text):
    return {
        'method': 'textDocument/didOpen',
        'params': {'textDocument': {'uri': uri, 'text': text}}
    }


def did_change(uri, changes: List):
    return {
        'method': 'textDocument/didChange',
        'params': {
            'textDocument': {'uri': uri},
            'contentChanges': changes
        }
    }


@pytest.mark.asyncio
@pytest.mark.parametrize('message_func, content, expected_content', [
    [did_open, 'content\nof\nopened\nfile', 'content\nof\nopened\nfile'],
    [did_change, [{'text': 'content after change'}], 'content after change']
])
async def test_shadow(tmpdir, message_func, content, expected_content):
    path = str(tmpdir.mkdir('.virtual_documents'))
    shadow = setup_shadow_filesystem(Path(path).as_uri())

    ok_file_path = Path(path) / 'test.py'

    message = message_func(ok_file_path.as_uri(), content)
    await shadow('client', message, ['python'], None)

    with open(ok_file_path) as f:
        assert f.read() == expected_content
