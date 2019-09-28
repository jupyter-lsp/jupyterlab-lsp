from jupyter_lsp import ConnectorCommands, LanguageServerManager


def connect_yaml_language_server(mgr: LanguageServerManager) -> ConnectorCommands:
    """ connect jupyter-lsproxy to yaml-language-server for yaml, if available
    """
    pkg = "yaml-language-server"
    yls = mgr.find_node_module(pkg, "bin", pkg)

    if yls:
        return [{"languages": "yaml", "args": [mgr.nodejs, yls, "--stdio"]}]

    return {}
