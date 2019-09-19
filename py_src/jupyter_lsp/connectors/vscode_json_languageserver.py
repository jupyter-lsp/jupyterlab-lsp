from jupyter_lsp import ConnectorCommands, LanguageServerApp


def connect_vscode_json_languageserver(app: LanguageServerApp) -> ConnectorCommands:
    """ connect to vscode-json-languageserver
    """
    pkg = "vscode-json-languageserver"
    vscjls = app.find_node_module(pkg, "bin", pkg)

    if vscjls:
        cmd = [app.nodejs, vscjls, "--stdio"]
        return {"json": cmd, "application/json": cmd}

    return {}
