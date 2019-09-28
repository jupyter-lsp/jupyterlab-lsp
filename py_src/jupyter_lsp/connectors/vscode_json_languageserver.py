from .utils import NodeModuleSpec


class VSCodeJSONLanguageServer(NodeModuleSpec):
    node_module = key = "vscode-json-languageserver-bin"
    script = ["jsonServerMain.js"]
    args = ["--stdio"]
    languages = ["json"]
