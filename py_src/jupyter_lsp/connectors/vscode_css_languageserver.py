from jupyter_lsp import ConnectorCommands, LanguageServerManager


def connect_vscode_css_languageserver(mgr: LanguageServerManager) -> ConnectorCommands:
    """ connect to vscode-css-languageserver
    """
    pkg = "vscode-css-languageserver-bin"
    vsccls = mgr.find_node_module(pkg, "cssServerMain.js")

    if vsccls:
        return [
            {
                "languages": ["css", "less", "scss"],
                "args": [mgr.nodejs, vsccls, "--stdio"],
            }
        ]

    return []
