# def test_config_cli(manager, arg_language_servers, falsy_pyls) -> None:
#     """ Ensure falsey values clobber autodetection
#     """
#     assert not manager.language_servers
#     manager.initialize(arg_language_servers({"python": falsy_pyls}))
#     assert "python" not in server.language_servers
