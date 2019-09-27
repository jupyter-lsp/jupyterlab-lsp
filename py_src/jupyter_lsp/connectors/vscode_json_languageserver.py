from jupyter_lsp import ConnectorCommands, LanguageServerApp


def connect_vscode_json_languageserver(app: LanguageServerApp) -> ConnectorCommands:
    """ connect to vscode-json-languageserver
    """
    pkg = "vscode-json-languageserver-bin"

    vscjls = app.find_node_module(pkg, "jsonServerMain.js")

    if vscjls:
        cmd = [app.nodejs, vscjls, "--stdio"]
        return {"json": cmd}

    return {}
