from jupyter_lsp import ConnectorCommands, LanguageServerApp


def connect_vscode_css_languageservice(app: LanguageServerApp) -> ConnectorCommands:
    """ connect to vscode-css-languageservice
    """
    pkg = "vscode-css-languageservice"
    vsccls = app.find_node_module(pkg, "bin", pkg)

    if vsccls:
        cmd = [app.nodejs, vsccls, "--stdio"]
        return {"json": cmd}

    return {}
