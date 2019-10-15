from .utils import NodeModuleSpec


class JavascriptTypescriptLanguageServer(NodeModuleSpec):
    node_module = key = "javascript-typescript-langserver"
    script = ["lib", "language-server-stdio.js"]
    languages = ["javascript", "jsx", "typescript", "typescript-jsx"]
