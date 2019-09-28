def test_start(handler):
    manager = handler.manager
    manager.initialize()
    handler.open("python")
    assert handler.session is not None
    assert handler.session.process is not None
