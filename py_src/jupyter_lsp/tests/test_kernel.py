import json

import pytest

from jupyter_lsp.kernel.install import DISPLAY_NAME, KERNEL_NAME
from jupyter_lsp.kernel.manager import CommLanguageServerManager
from jupyter_lsp.lspapp import LSPKernelSpecInstallApp

CUSTOM_NAME = "custom-ilsp-2"


@pytest.mark.parametrize(
    "kernel_name,display_name,expect_kernel_name,expect_display_name",
    [
        [None, None, KERNEL_NAME, DISPLAY_NAME],
        [None, "Foo", KERNEL_NAME, "Foo"],
        [CUSTOM_NAME, None, CUSTOM_NAME, CUSTOM_NAME],
    ],
)
def test_kernel_install(
    kernel_name, display_name, expect_kernel_name, expect_display_name, tmp_path
):
    app = LSPKernelSpecInstallApp(
        prefix=tmp_path, kernel_name=kernel_name, display_name=display_name
    )
    app.start()
    spec = tmp_path / "share/jupyter/kernels/{}/kernel.json".format(expect_kernel_name)
    assert spec.exists()
    spec_json = json.loads(spec.read_text())
    LSPKernelSpecInstallApp()
    assert spec_json["display_name"] == expect_display_name, spec_json


@pytest.mark.asyncio
def test_kernel_manager_control_comm(handlers, mock_comm):
    handler, ws_handler = handlers
    manager = handler.manager
    if not isinstance(manager, CommLanguageServerManager):
        return
    manager.initialize()
    manager.on_control_comm_opened(mock_comm, None)
    assert mock_comm._sent


@pytest.mark.asyncio
def test_kernel_manager_server_comm(handlers, mock_comm):
    handler, ws_handler = handlers
    manager = handler.manager
    if not isinstance(manager, CommLanguageServerManager):
        return
    manager.initialize()
    manager.on_language_server_comm_opened(
        mock_comm, dict(metadata=dict(language_server="pyls"))
    )
