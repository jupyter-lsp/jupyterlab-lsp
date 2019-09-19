from jupyter_lsp import ConnectorCommands, LanguageServerApp


def connect_yaml_language_server(app: LanguageServerApp) -> ConnectorCommands:
    """ connect jupyter-lsproxy to yaml-language-server for yaml, if available
    """
    pkg = "yaml-language-server"
    yls = app.find_node_module(pkg, "bin", pkg)

    if yls:
        cmd = [app.nodejs, yls, "--stdio"]
        return {"yaml": cmd, "application/yaml": cmd}

    return {}
