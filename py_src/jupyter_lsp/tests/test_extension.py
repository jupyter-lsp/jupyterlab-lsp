def test_serverextension(app):
    app.initialize(
        ["--NotebookApp.nbserver_extensions={'jupyter_lsp.serverextension': True}"]
    )
    assert app.language_server_manager
    found_lsp = False
    for r in app.web_app.default_router.rules:
        for rr in r.target.rules:
            if "/lsp/" in str(rr.matcher.regex):
                found_lsp = True

    assert found_lsp, "apparently didn't install the /lsp/ route"
