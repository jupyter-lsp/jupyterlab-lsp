from .utils import NodeModuleSpec


class VSCodeHTMLLanguageServer(NodeModuleSpec):
    node_module = key = "vscode-html-languageserver-bin"
    script = ["htmlServerMain.js"]
    args = ["--stdio"]
    languages = ["html"]
    spec = dict(
        display_name=key,
        mime_types=["text/html"],
        urls=dict(
            home="https://github.com/vscode-langservers/{}".format(key),
            issues="https://github.com/vscode-langservers/{}/issues".format(key),
        ),
        install=dict(
            npm="npm install {}".format(key),
            yarn="yarn add {}".format(key),
            jupyter="jupyter labextension link {}".format(key),
        ),
    )
