from pathlib import Path
from jupyterlab.commands import get_app_dir

# TODO: also check env_vars, previous config, or just on path
node_modules = Path(get_app_dir()) / "staging" / "node_modules"
proxy = node_modules / "jsonrpc-ws-proxy" / "dist" / "server.js"
servers_yml = Path(__file__).parent / "servers.yml"


c.ServerProxy.servers = {
  "lsp": {
    "command": [str(proxy), "--port", "{port}", "--languageServers", str(servers_yml)],
    "absolute_url": False
  }
}
