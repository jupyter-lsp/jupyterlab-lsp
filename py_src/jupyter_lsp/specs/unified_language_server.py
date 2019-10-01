from .utils import NodeModuleSpec


class UnifiedLanguageServer(NodeModuleSpec):
    node_module = key = "unified-language-server"
    script = ["src", "server.js"]
    args = ["--parser=remark-parse", "--stdio"]
    languages = ["markdown", "ipythongfm"]
