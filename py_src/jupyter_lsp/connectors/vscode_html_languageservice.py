from jupyter_lsp import ConnectorCommands, LanguageServerApp


def connect_vscode_html_languageservice(app: LanguageServerApp) -> ConnectorCommands:
    """ connect to vscode-html-languageservice
    """
    pkg = "vscode-html-languageservice"
    vschls = app.find_node_module(pkg, "bin", pkg)

    if vschls:
        cmd = [app.nodejs, vschls, "--stdio"]
        return {"html": cmd}

    return {}
