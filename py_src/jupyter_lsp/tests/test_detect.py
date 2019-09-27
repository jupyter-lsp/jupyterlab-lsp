def test_detect(server):
    server.initialize(["--LanguageServerApp.autodetect=False"])
    assert not server.language_servers
