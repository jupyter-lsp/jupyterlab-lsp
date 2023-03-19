from jupyter_lsp.specs.python_lsp_server import PythonLSPServer
from jupyter_lsp.types import LanguageServerManagerAPI


manager: LanguageServerManagerAPI = None   # type: ignore
pylsp_base: dict = PythonLSPServer()(manager)


c.LanguageServerManager.language_servers.update({
    "pylsp-with-override-spec": {
        **pylsp_base["pylsp"],
        "display_name": "pylsp (with override via server spec)",
        "workspace_configuration": {
          "pylsp.plugins.flake8.enabled": True,
          "pylsp.plugins.pyflakes.enabled": False
        }
    },
    "pylsp-with-override-json": {
        **pylsp_base["pylsp"],
        "display_name": "pylsp (with override via overrides.json)"
    }
})
