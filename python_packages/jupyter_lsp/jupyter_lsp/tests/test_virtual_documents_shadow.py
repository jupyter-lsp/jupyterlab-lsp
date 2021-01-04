from pathlib import Path
from typing import List

import pytest

from ..virtual_documents_shadow import (
    EditableFile,
    ShadowFilesystemError,
    extract_or_none,
    setup_shadow_filesystem,
)


@pytest.mark.asyncio
async def test_read(tmp_path):
    path = tmp_path / "existing.py"
    path.write_text("a\ntest")

    editable_file = EditableFile(path)

    await editable_file.read()

    assert editable_file.lines == ["a", "test"]


@pytest.mark.asyncio
async def test_read_missing(tmp_path):
    path = tmp_path / "missing.py"
    missing_file = EditableFile(path)

    await missing_file.read()

    assert missing_file.lines == [""]


@pytest.mark.asyncio
async def test_apply_change(tmp_path):
    # inserting text
    path = tmp_path / "test.py"
    editable_file = EditableFile(path)
    await editable_file.read()

    editable_file.apply_change("new\ntext", **editable_file.full_range)
    assert editable_file.lines == ["new", "text"]

    # modifying a range
    editable_file.apply_change(
        "ves", start={"line": 1, "character": 0}, end={"line": 1, "character": 3}
    )
    assert editable_file.lines == ["new", "vest"]

    editable_file.apply_change("", **editable_file.full_range)
    assert editable_file.lines == [""]


def test_extract_or_none():
    obj = {"nested": {"value": 1}}
    assert extract_or_none(obj, ["nested"]) == {"value": 1}
    assert extract_or_none(obj, ["nested", "value"]) == 1
    assert extract_or_none(obj, ["missing", "value"]) is None


def did_open(uri, text):
    return {
        "method": "textDocument/didOpen",
        "params": {"textDocument": {"uri": uri, "text": text}},
    }


def did_change(uri, changes: List):
    return {
        "method": "textDocument/didChange",
        "params": {"textDocument": {"uri": uri}, "contentChanges": changes},
    }


def did_save_with_text(uri, text):
    return {
        "method": "textDocument/didSave",
        "params": {"textDocument": {"uri": uri, "text": text}},
    }


def did_save_without_text(uri):
    return {"method": "textDocument/didSave", "params": {"textDocument": {"uri": uri}}}


@pytest.fixture
def shadow_path(tmpdir):
    return str(tmpdir.mkdir(".virtual_documents"))


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "message_func, content, expected_content",
    [
        [did_open, "content\nof\nopened\nfile", "content\nof\nopened\nfile"],
        [did_change, [{"text": "content after change"}], "content after change"],
        [did_save_with_text, "content at save", "content at save"],
    ],
)
async def test_shadow(shadow_path, message_func, content, expected_content):
    shadow = setup_shadow_filesystem(Path(shadow_path).as_uri())
    ok_file_path = Path(shadow_path) / "test.py"

    message = message_func(ok_file_path.as_uri(), content)
    result = await shadow("client", message, ["python"], None)
    assert isinstance(result, str)

    with open(str(ok_file_path)) as f:  # str is a Python 3.5 relict
        assert f.read() == expected_content


@pytest.mark.asyncio
async def test_shadow_failures(shadow_path):

    shadow = setup_shadow_filesystem(Path(shadow_path).as_uri())
    ok_file_uri = (Path(shadow_path) / "test.py").as_uri()

    def run_shadow(message):
        return shadow("client", message, ["python"], None)

    # missing textDocument
    with pytest.raises(ShadowFilesystemError, match="Could not get textDocument from"):
        await run_shadow({"method": "textDocument/didChange"})

    # missing URI
    with pytest.raises(ShadowFilesystemError, match="Could not get URI from"):
        await run_shadow(
            {"method": "textDocument/didChange", "params": {"textDocument": {}}}
        )

    # should ignore other methods
    result = await run_shadow({"method": "textDocument/completion"})
    assert result is None

    # should NOT intercept (nor shadow) files from location other than shadow_path
    result = await run_shadow(did_open("file:///other/path.py", "content"))
    assert result is None

    # should fail silently on missing text in didSave
    result = await run_shadow(did_save_without_text(ok_file_uri))
    assert result is None

    # should raise on missing changes in didChange
    with pytest.raises(ShadowFilesystemError, match=".* is missing contentChanges"):
        await run_shadow(
            {
                "method": "textDocument/didChange",
                "params": {"textDocument": {"uri": ok_file_uri}},
            }
        )
