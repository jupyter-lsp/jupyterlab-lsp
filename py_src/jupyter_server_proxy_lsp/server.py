""" A `jupyter-server-proxy`-ready configuration frontend for `jsonrpc-ws-proxy`
"""
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

from jupyter_core.application import JupyterApp, base_aliases, base_flags
from jupyterlab.commands import get_app_dir
from traitlets import Bool, Dict, Int, List, Unicode, default

from ._version import __version__

JWP = "jsonrpc-ws-proxy"

aliases = dict(port="LanguageServerApp.port", **base_aliases)

flags = dict(**base_flags)


class LanguageServerApp(JupyterApp):
    """ An bridge to jsonrpc-ws-proxy
    """

    # version = __version__

    aliases = aliases
    flags = flags

    language_servers = Dict(
        {}, help="a dictionary of lists of command arguments keyed by language names"
    ).tag(config=True)

    port = Int(help="the (dynamically) assigned port to pass to jsonrpc-ws-proxy").tag(
        config=True
    )

    jsonrpc_ws_proxy = Unicode(help="path to jsonrpc-ws-proxy/dist/server.js").tag(
        config=True
    )

    node = Unicode(help="path to nodejs executable").tag(config=True)

    autodetect = Bool(
        True, help="try to find known language servers in sys.prefix (and elsewhere)"
    ).tag(config=True)

    extra_node_roots = List([], help="additional places to look for node_modules").tag(
        config=True
    )

    cmd = List().tag(config=True)

    def start(self):
        """ Start the Notebook server app, after initialization

        This method takes no arguments so all configuration and initialization
        must be done prior to calling this method."""

        super().start()

        with tempfile.TemporaryDirectory() as td:
            config_file = pathlib.Path(td) / "langservers.yml"

            if self.autodetect:
                language_servers = self._autodetect_language_servers()
            else:
                language_servers = {}

            language_servers.update(self.language_servers)

            config_json = json.dumps(
                {"langservers": language_servers}, indent=2, sort_keys=True
            )
            config_file.write_text(config_json)

            self.log.debug(config_json)

            args = self.cmd + [
                "--port",
                str(self.port),
                "--languageServers",
                str(config_file),
            ]

            return subprocess.check_call(args, cwd=td)

    def _autodetect_language_servers(self):
        servers = {}

        self.find_python(servers)
        self.find_js(servers)
        self.find_json(servers)
        self.find_yaml(servers)

        return servers

    def find_js(self, servers):
        jstsls = self._find_node_module(
            "javascript-typescript-langserver", "lib", "language-server.js"
        )

        if not jstsls:
            return

        servers["application/typescript"] = servers["javascript"] = [self.node, jstsls]

    def find_json(self, servers):
        vscjls = self._find_node_module(
            "vscode-json-languageserver", "bin", "vscode-json-languageserver"
        )

        if not vscjls:
            return

        servers["json"] = servers["application/json"] = [self.node, vscjls]

    def find_python(self, servers):
        if shutil.which("pyls"):
            servers["python"] = ["pyls"]

    def find_yaml(self, servers):
        yls = self._find_node_module(
            "yaml-language-server", "bin", "yaml-language-server"
        )
        if not yls:
            return

        servers["yaml"] = servers["application/yaml"] = [self.node, yls]

    @default("node")
    def _default_node(self):
        return shutil.which("node") or shutil.which("nodejs")

    @default("jsonrpc_ws_proxy")
    def _default_jsonrpc_ws_proxy(self):
        """ try to find
        """
        return shutil.which(JWP) or self._find_node_module(JWP, "dist", "server.js")

    @default("cmd")
    def _default_cmd(self):
        return [self.node, self.jsonrpc_ws_proxy]

    def _find_node_module(self, *path_frag):
        for candidate_root in self.extra_node_roots + [
            pathlib.Path(get_app_dir()) / "staging",
            sys.prefix,
            os.getcwd(),
        ]:
            candidate = pathlib.Path(candidate_root, "node_modules", *path_frag)
            if candidate.exists():
                return str(candidate)


main = launch_new_instance = LanguageServerApp.launch_instance

if __name__ == "__main__":
    sys.exit(main())
