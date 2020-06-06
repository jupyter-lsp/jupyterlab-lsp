from jupyter_lsp.lspapp import LSPApp, LSPKernelSpecApp


def test_app():
    # nb: probably test install?
    apps = LSPApp(), LSPKernelSpecApp()
    assert apps
