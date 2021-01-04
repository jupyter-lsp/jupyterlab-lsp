""" add language server support to the running jupyter notebook application
"""
import json
from pathlib import Path

import traitlets

from .handlers import add_handlers
from .manager import LanguageServerManager
from .paths import normalized_uri
from .virtual_documents_shadow import setup_shadow_filesystem


def load_jupyter_server_extension(nbapp):
    """create a LanguageServerManager and add handlers"""
    nbapp.add_traits(language_server_manager=traitlets.Instance(LanguageServerManager))
    manager = nbapp.language_server_manager = LanguageServerManager(parent=nbapp)
    manager.initialize()

    contents = nbapp.contents_manager
    page_config = nbapp.web_app.settings.setdefault("page_config_data", {})

    # try to set the rootUri from the contents manager path
    if hasattr(contents, "root_dir"):
        root_uri = normalized_uri(contents.root_dir)
        page_config["rootUri"] = root_uri
        nbapp.log.debug("[lsp] rootUri will be %s", root_uri)

        virtual_documents_uri = normalized_uri(
            Path(contents.root_dir) / manager.virtual_documents_dir
        )
        page_config["virtualDocumentsUri"] = virtual_documents_uri
        nbapp.log.debug("[lsp] virtualDocumentsUri will be %s", virtual_documents_uri)
    else:  # pragma: no cover
        page_config["rootUri"] = ""
        page_config["virtualDocumentsUri"] = ""
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

    setup_shadow_filesystem(virtual_documents_uri=virtual_documents_uri)
