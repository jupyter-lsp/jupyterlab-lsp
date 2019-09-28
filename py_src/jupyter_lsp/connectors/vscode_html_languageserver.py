from jupyter_lsp import ConnectorCommands, LanguageServerManager


def connect_vscode_html_languageserver(mgr: LanguageServerManager) -> ConnectorCommands:
    """ connect to vscode-html-languageserver
    """
    pkg = "vscode-html-languageserver-bin"
    vschls = mgr.find_node_module(pkg, "htmlServerMain.js")

    if vschls:
        return [{"languages": ["html"], "args": [mgr.nodejs, vschls, "--stdio"]}]

    return []
