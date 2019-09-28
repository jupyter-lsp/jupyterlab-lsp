import traitlets
from notebook.utils import url_path_join as ujoin

from .handlers import LanguageServerWebSocketHandler
from .manager import LanguageServerManager


def load_jupyter_server_extension(nbapp):
    """ create a LanguageServerManager and add handlers
    """
    nbapp.add_traits(language_server_manager=traitlets.Instance(LanguageServerManager))
    nbapp.language_server_manager = LanguageServerManager(parent=nbapp)
    nbapp.language_server_manager.initialize()
    nbapp.web_app.add_handlers(
        ".*",
        [
            (
                ujoin(nbapp.base_url, "lsp", "(?P<language>.*)"),
                LanguageServerWebSocketHandler,
                {"manager": nbapp.language_server_manager},
            )
        ],
    )
