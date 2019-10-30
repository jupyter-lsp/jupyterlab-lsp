from .utils import NodeModuleSpec


class VSCodeHTMLLanguageServer(NodeModuleSpec):
    node_module = key = "vscode-html-languageserver-bin"
    script = ["htmlServerMain.js"]
    args = ["--stdio"]
    languages = ["html"]
