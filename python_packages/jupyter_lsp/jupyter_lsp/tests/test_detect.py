import shutil

from jupyter_lsp.specs.r_languageserver import RLanguageServer


def test_no_detect(manager):
    """should not enable anything by default"""
    manager.autodetect = False
    manager.initialize()
    assert not manager.language_servers
    assert not manager.sessions


def test_detect(manager):
    manager.initialize()
    assert len(manager.sessions) == len(manager.language_servers)


def test_r_package_detection():
    existing_runner = shutil.which("Rscript")

    with_installed_server = RLanguageServer()
    assert with_installed_server.is_installed(cmd=existing_runner) is True
    assert with_installed_server.is_installed(cmd=None) is False

    class NonInstalledRServer(RLanguageServer):
        package = "languageserver-fork"

    non_installed_server = NonInstalledRServer()
    assert non_installed_server.is_installed(cmd=existing_runner) is False
