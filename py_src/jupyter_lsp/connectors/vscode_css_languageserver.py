from jupyter_lsp import ConnectorCommands, LanguageServerApp


def connect_vscode_css_languageserver(app: LanguageServerApp) -> ConnectorCommands:
    """ connect to vscode-css-languageserver
    """
    pkg = "vscode-css-languageserver-bin"
    vsccls = app.find_node_module(pkg, "cssServerMain.js")

    if vsccls:
        cmd = [app.nodejs, vsccls, "--stdio"]
        return {"css": cmd, "less": cmd, "scss": cmd}

    return {}
