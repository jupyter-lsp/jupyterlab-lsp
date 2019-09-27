from jupyter_lsp import ConnectorCommands, LanguageServerApp


def connect_vscode_html_languageserver(app: LanguageServerApp) -> ConnectorCommands:
    """ connect to vscode-html-languageserver
    """
    pkg = "vscode-html-languageserver-bin"
    vschls = app.find_node_module(pkg, "htmlServerMain.js")

    if vschls:
        cmd = [app.nodejs, vschls, "--stdio"]
        return {"html": cmd}

    return {}
