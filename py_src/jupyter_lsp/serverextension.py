""" add language server support to the running jupyter notebook application
"""
import json

import traitlets
from notebook.utils import url_path_join as ujoin

from .handlers import LanguageServersHandler, LanguageServerWebSocketHandler
from .manager import LanguageServerManager


def load_jupyter_server_extension(nbapp):
    """ create a LanguageServerManager and add handlers
    """
    nbapp.add_traits(language_server_manager=traitlets.Instance(LanguageServerManager))
    manager = nbapp.language_server_manager = LanguageServerManager(parent=nbapp)
    manager.initialize()
    nbapp.log.debug(
        "The following Language Servers will be available: {}".format(
            json.dumps(manager.language_servers, indent=2, sort_keys=True)
        )
    )

    lsp_url = ujoin(nbapp.base_url, "lsp")
    re_langs = "(?P<language>.*)"

    opts = {"manager": nbapp.language_server_manager}

    nbapp.web_app.add_handlers(
        ".*",
        [
            (lsp_url, LanguageServersHandler, opts),
            (ujoin(lsp_url, re_langs), LanguageServerWebSocketHandler, opts),
        ],
    )
