from jupyter_lsp import ConnectorCommands, LanguageServerManager


def connect_vscode_json_languageserver(mgr: LanguageServerManager) -> ConnectorCommands:
    """ connect to vscode-json-languageserver
    """
    pkg = "vscode-json-languageserver-bin"
    vscjls = mgr.find_node_module(pkg, "jsonServerMain.js")

    if vscjls:
        return [{"languages": ["json"], "args": [mgr.nodejs, vscjls, "--stdio"]}]

    return []
