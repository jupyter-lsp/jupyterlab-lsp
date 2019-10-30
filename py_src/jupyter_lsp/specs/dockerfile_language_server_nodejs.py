from .utils import NodeModuleSpec


class DockerfileLanguageServerNodeJS(NodeModuleSpec):
    node_module = key = "dockerfile-language-server-nodejs"
    script = ["lib", "server.js"]
    args = ["--stdio"]
    languages = ["dockerfile"]
