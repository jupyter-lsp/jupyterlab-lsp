from jupyter_lsp import ConnectorCommands, LanguageServerManager


def connect_javascript_typescript_langserver(
    mgr: LanguageServerManager
) -> ConnectorCommands:
    """ connect jupyter-lsproxy to javascript-typescript-langserver for javascript
        and typescript (if available)
    """
    jstsls = mgr.find_node_module(
        "javascript-typescript-langserver", "lib", "language-server-stdio.js"
    )

    if jstsls:
        return [
            {"languages": ["typescript", "javascript"], "args": [mgr.nodejs, jstsls]}
        ]

    return []
