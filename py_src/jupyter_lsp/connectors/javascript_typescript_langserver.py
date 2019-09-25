from jupyter_lsp import ConnectorCommands, LanguageServerApp


def connect_javascript_typescript_langserver(
    app: LanguageServerApp
) -> ConnectorCommands:
    """ connect jupyter-lsproxy to javascript-typescript-langserver for javascript
        and typescript (if available)
    """
    jstsls = app.find_node_module(
        "javascript-typescript-langserver", "lib", "language-server-stdio.js"
    )

    if jstsls:
        cmd = [app.nodejs, jstsls]
        return {"typescript": cmd, "javascript": cmd}

    return {}
