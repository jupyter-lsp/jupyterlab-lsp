def test_detect(manager):
    """ should not enable anything by default
    """
    manager.autodetect = False
    manager.initialize()
    assert not manager.language_servers
