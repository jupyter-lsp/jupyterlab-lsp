from jupyter_lsp import ConnectorCommands, LanguageServerApp


def connect_vscode_json_languageservice(app: LanguageServerApp) -> ConnectorCommands:
    """ connect to vscode-json-languageservice
    """
    pkg = "vscode-json-languageserver"
    vscjls = app.find_node_module(pkg, "bin", pkg)

    if vscjls:
        cmd = [app.nodejs, vscjls, "--stdio"]
        return {"json": cmd}

    return {}
