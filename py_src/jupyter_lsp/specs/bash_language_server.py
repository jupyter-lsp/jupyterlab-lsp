from .utils import NodeModuleSpec


class BashLanguageServer(NodeModuleSpec):
    node_module = key = "bash-language-server"
    script = ["bin", "main.js"]
    args = ["start"]
    languages = ["bash", "sh"]
