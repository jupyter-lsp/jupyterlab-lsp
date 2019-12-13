""" add language server support to the running jupyter notebook application
"""
import json
import os
from pathlib import Path

import traitlets

from .handlers import add_handlers
from .manager import LanguageServerManager
from .paths import normalized_uri, file_uri_to_path


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
        root_uri = normalized_uri(contents.root_dir)
        page_config["rootUri"] = root_uri
        nbapp.log.debug("[lsp] rootUri will be %s", root_uri)
        page_config["virtualDocumentsUri"] = os.path.join(root_uri, '.virtual_documents')
        nbapp.log.debug("[lsp] virtualDocumentsUri will be %s", page_config["virtualDocumentsUri"])
    else:  # pragma: no cover
        page_config["rootUri"] = ''
        page_config["virtualDocumentsUri"] = ''
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

    lsp_message_listener = LanguageServerManager.register_message_listener  # noqa

    def extract_or_none(obj, path):
        for crumb in path:
            try:
                obj = obj[crumb]
            except (KeyError, TypeError):
                return None
        return obj

    @lsp_message_listener("client")
    async def my_listener(scope, message, languages, manager):
        write_on = [
            'textDocument/didOpen',
            'textDocument/didChange',
            'textDocument/didSave'
        ]

        if 'method' in message and message['method'] in write_on:

            document = extract_or_none(message, ['params', 'textDocument'])
            if not document:
                print('Could not get document from: {}'.format(message))
                return

            uri = extract_or_none(document, ['uri'])
            if not uri or document is None:
                print('Could not get URI from: {}'.format(message))
                return

            if not uri.startswith(page_config["virtualDocumentsUri"]):
                return

            path = file_uri_to_path(uri)

            text = extract_or_none(document, ['text'])

            if text is None:
                changes = message['params']['contentChanges']
                assert len(changes) == 1
                text = changes[0]['text']

            Path(path).parent.mkdir(parents=True, exist_ok=True)

            with open(path, 'w') as f:
                f.write(text)
