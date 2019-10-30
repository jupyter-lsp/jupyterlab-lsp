from .utils import NodeModuleSpec


class YAMLLanguageServer(NodeModuleSpec):
    node_module = key = "yaml-language-server"
    script = ["bin", key]
    args = ["--stdio"]
    languages = ["yaml"]
