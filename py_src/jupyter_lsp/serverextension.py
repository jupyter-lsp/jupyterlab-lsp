""" add language server support to the running jupyter notebook application
"""
import json
import pathlib

import traitlets
from notebook.utils import url_path_join as ujoin

from .handlers import LanguageServersHandler, LanguageServerWebSocketHandler
from .manager import LanguageServerManager


def load_jupyter_server_extension(nbapp):
    """ create a LanguageServerManager and add handlers
    """
    web_app = nbapp.web_app
    nbapp.add_traits(language_server_manager=traitlets.Instance(LanguageServerManager))
    manager = nbapp.language_server_manager = LanguageServerManager(parent=nbapp)
    manager.initialize()
    nbapp.log.debug(
        "[lsp] The following Language Servers will be available: {}".format(
            json.dumps(manager.language_servers, indent=2, sort_keys=True)
        )
    )

    lsp_url = ujoin(nbapp.base_url, "lsp")
    re_langs = "(?P<language>.*)"

    opts = {"manager": nbapp.language_server_manager}

    contents = nbapp.contents_manager

    if hasattr(contents, "root_dir"):
        root_dir = pathlib.Path(contents.root_dir).resolve()
        # normalize for windows case
        if root_dir.drive and root_dir.drive.endswith(":"):  # pragma: no cover
            root_dir.drive = root_dir.drive.lower()
        root_uri = root_dir.as_uri()
        web_app.settings.setdefault("page_config_data", {})["rootUri"] = root_uri
    else:  # pragma: no cover
        nbapp.log.warn(
            "[lsp] %s did not appear to have a root_dir, could not set rootUri",
            contents,
        )

    web_app.add_handlers(
        ".*",
        [
            (lsp_url, LanguageServersHandler, opts),
            (ujoin(lsp_url, re_langs), LanguageServerWebSocketHandler, opts),
        ],
    )
