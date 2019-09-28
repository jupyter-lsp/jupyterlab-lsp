def test_no_detect(manager):
    """ should not enable anything by default
    """
    manager.autodetect = False
    manager.initialize()
    assert not manager.language_servers
    assert not manager.sessions


def test_detect(manager):
    manager.initialize()
    assert len(manager.sessions) == len(manager.language_servers)
