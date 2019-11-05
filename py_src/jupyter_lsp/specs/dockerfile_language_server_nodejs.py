from .config import load_config_schema
from .utils import NodeModuleSpec


class DockerfileLanguageServerNodeJS(NodeModuleSpec):
    node_module = key = "dockerfile-language-server-nodejs"
    script = ["lib", "server.js"]
    args = ["--stdio"]
    languages = ["dockerfile"]
    spec = dict(
        display_name=key,
        mime_types=["text/x-dockerfile"],
        urls=dict(
            home="https://github.com/rcjsuen/{}".format(key),
            issues="https://github.com/rcjsuen/{}/issues".format(key),
        ),
        install=dict(
            npm="npm install {}".format(key),
            yarn="yarn add {}".format(key),
            jupyter="jupyter labextension link {}".format(key),
        ),
        config_schema=load_config_schema(key),
    )
