import json

import pytest

from jupyter_lsp.kernel.install import DISPLAY_NAME, KERNEL_NAME, install

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
    install(prefix=tmp_path, kernel_name=kernel_name, display_name=display_name)
    spec = tmp_path / "share/jupyter/kernels/{}/kernel.json".format(expect_kernel_name)
    assert spec.exists()
    spec_json = json.loads(spec.read_text())
    assert spec_json["display_name"] == expect_display_name, spec_json
