from jupyter_lsp import LanguageServerApp, ConnectorCommands


def connect_javascript_typescript_langserver(app: LanguageServerApp) -> ConnectorCommands:
    """ connect jupyter-lsproxy to javascript-typescript-langserver for javascript
        and typescript (if available)
    """
    jstsls = self._find_node_module(
        "javascript-typescript-langserver", "lib", "language-server.js"
    )

    if jstsls:
        cmd = [app.nodejs, jstsls]
        return {
            "application/typescript": cmd,
            "javascript": cmd
        }

    return {}
