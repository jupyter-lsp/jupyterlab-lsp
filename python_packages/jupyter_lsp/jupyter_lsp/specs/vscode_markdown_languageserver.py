from .utils import NodeModuleSpec


class VSCodeMarkdownLanguageServer(NodeModuleSpec):
    node_module = key = "vscode-markdown-languageserver"
    script = [["dist","node","workerMain.js"]]
    args = ["--stdio"]
    languages = ["markdown", "ipythongfm", "gfm"]
    spec = dict(
        display_name=key,
        mime_types=["text/x-gfm", "text/x-ipythongfm", "text/x-markdown"],
        urls=dict(
            home="https://github.com/microsoft/{}".format(key),
            issues="https://github.com/microsoft/{}/issues".format(key),
        ),
        install=dict(
            npm="npm install --save-dev {}".format(key),
            yarn="yarn add --dev {}".format(key),
            jlpm="jlpm add --dev {}".format(key),
        ),
    )
