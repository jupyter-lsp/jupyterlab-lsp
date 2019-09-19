from jupyter_lsp import LanguageServerApp, ConnectorCommands


def connect_vscode_json_languageserver(app: LanguageServerApp) -> ConnectorCommands:
    """ connect to vscode-json-languageserver
    """
    pkg = "vscode-json-languageserver"
    vscjls = app.find_node_module(pkg, "bin", pkg)

    if vscjls:
        cmd = [app.nodejs, yls, "--stdio"]
        return {
            "yaml": cmd,
            "application/yaml": cmd
        }

    return {}
