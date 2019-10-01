from .utils import NodeModuleSpec


class VSCodeCSSLanguageServer(NodeModuleSpec):
    node_module = key = "vscode-css-languageserver-bin"
    script = ["cssServerMain.js"]
    args = ["--stdio"]
    languages = ["css", "less", "scss"]
