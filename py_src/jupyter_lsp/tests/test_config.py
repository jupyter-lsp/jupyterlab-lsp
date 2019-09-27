def test_config_cli(server, arg_language_servers, falsy_pyls) -> None:
    """ Ensure falsey values clobber autodetection
    """
    assert not server.language_servers
    server.initialize(arg_language_servers({"python": falsy_pyls}))
    assert "python" not in server.language_servers
