""" add language server support to the running jupyter notebook application
"""
import json
from pathlib import Path

import traitlets

from .handlers import add_handlers
from .manager import LanguageServerManager
from .paths import normalized_uri


async def initialize(nbapp, virtual_documents_uri):  # pragma: no cover
    """Perform lazy initialization."""
    import concurrent.futures

    from .virtual_documents_shadow import setup_shadow_filesystem

    manager = nbapp.language_server_manager

    with concurrent.futures.ThreadPoolExecutor() as pool:
        await nbapp.io_loop.run_in_executor(pool, manager.initialize)

    setup_shadow_filesystem(virtual_documents_uri=virtual_documents_uri)

    nbapp.log.debug(
        "[lsp] The following Language Servers will be available: {}".format(
            json.dumps(manager.language_servers, indent=2, sort_keys=True)
        )
    )


def load_jupyter_server_extension(nbapp):
    """create a LanguageServerManager and add handlers"""
    nbapp.add_traits(language_server_manager=traitlets.Instance(LanguageServerManager))
    manager = nbapp.language_server_manager = LanguageServerManager(parent=nbapp)

    contents = nbapp.contents_manager
    page_config = nbapp.web_app.settings.setdefault("page_config_data", {})

    root_uri = ""
    virtual_documents_uri = ""

    # try to set the rootUri from the contents manager path
    if hasattr(contents, "root_dir"):
        root_uri = normalized_uri(contents.root_dir)
        nbapp.log.debug("[lsp] rootUri will be %s", root_uri)
        virtual_documents_uri = normalized_uri(
            Path(contents.root_dir) / manager.virtual_documents_dir
        )
        nbapp.log.debug("[lsp] virtualDocumentsUri will be %s", virtual_documents_uri)
    else:  # pragma: no cover
        nbapp.log.warn(
            "[lsp] %s did not appear to have a root_dir, could not set rootUri",
            contents,
        )
    page_config.update(rootUri=root_uri, virtualDocumentsUri=virtual_documents_uri)

    add_handlers(nbapp)
    nbapp.io_loop.call_later(0, initialize, nbapp, virtual_documents_uri)
