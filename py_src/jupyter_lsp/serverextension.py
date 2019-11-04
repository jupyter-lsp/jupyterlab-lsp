""" add language server support to the running jupyter notebook application
"""
import json

import traitlets

from .handlers import add_handlers
from .manager import LanguageServerManager
from .paths import normalized_uri


def load_jupyter_server_extension(nbapp):
    """ create a LanguageServerManager and add handlers
    """
    nbapp.add_traits(language_server_manager=traitlets.Instance(LanguageServerManager))
    manager = nbapp.language_server_manager = LanguageServerManager(parent=nbapp)
    manager.initialize()

    contents = nbapp.contents_manager
    page_config = nbapp.web_app.settings.setdefault("page_config_data", {})

    # try to set the rootUri from the contents manager path
    if hasattr(contents, "root_dir"):
        page_config["rootUri"] = normalized_uri(contents.root_dir)
        nbapp.log.debug("[lsp] rootUri will be %s", page_config["rootUri"])
    else:  # pragma: no cover
        nbapp.log.warn(
            "[lsp] %s did not appear to have a root_dir, could not set rootUri",
            contents,
        )

    add_handlers(nbapp)

    nbapp.log.debug(
        "[lsp] The following Language Servers will be available: {}".format(
            json.dumps(manager.language_servers, indent=2, sort_keys=True)
        )
    )
