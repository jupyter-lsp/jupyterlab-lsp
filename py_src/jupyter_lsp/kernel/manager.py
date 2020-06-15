import os

from jupyter_core.paths import jupyter_config_path

# this is the last remaining import of notebook... would be lovely to remove
from notebook.services.config import ConfigManager
from traitlets import Instance, Unicode, default

from ..manager import LanguageServerManager
from ..paths import normalized_uri
from ..schema import SERVERS_RESPONSE, SPEC_VERSION
from ..virtual_documents_shadow import setup_shadow_filesystem
from .handlers import CommHandler


class CommLanguageServerManager(LanguageServerManager):
    COMM_TARGET = "jupyter.lsp"

    config_manager = Instance(ConfigManager)
    root_uri = Unicode()
    virtual_documents_uri = Unicode()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._load_extra_config()

    @property
    def log(self):
        return self.parent.log

    @property
    def comm_manager(self):
        return self.parent.comm_manager

    @default("root_uri")
    def _default_root_uri(self):
        return normalized_uri(os.getcwd())

    @default("virtual_documents_uri")
    def _default_virtual_docs_uri(self):
        return self.root_uri + "/.virtual_documents"

    @default("config_manager")
    def _default_config_manager(self):
        """ load merged config from more jupyter_notebook_config.d files
            re-uses notebook loading machinery to look through more locations
        """
        manager = ConfigManager(read_config_path=jupyter_config_path() + [os.getcwd()])
        return manager

    def _load_extra_config(self):
        """ imitate legacy behavior of being able to load from notebook server config
        """
        from_config = self.config_manager.get("jupyter_notebook_config").get(
            "LanguageServerManager"
        )
        traits = self.trait_names()
        for key, value in (from_config or {}).items():  # pragma: no cover
            if key in traits:
                setattr(self, key, value)

    def initialize(self, *args, **kwargs):
        setup_shadow_filesystem(virtual_documents_uri=self.virtual_documents_uri)
        super().initialize(*args, **kwargs)
        self.init_comm_targets()

    def init_comm_targets(self):
        self.comm_manager.register_target(
            self.COMM_TARGET, self.on_language_server_comm_opened
        )

    def get_status_response(self):
        response = {
            "version": SPEC_VERSION,
            "sessions": {
                language_server: session.to_json()
                for language_server, session in self.sessions.items()
            },
            "uris": {
                "root": self.root_uri,
                "virtual_documents": self.virtual_documents_uri,
            },
        }

        errors = list(SERVERS_RESPONSE.iter_errors(response))

        if errors:  # pragma: no cover
            self.log.warn("{} validation errors: {}", len(errors), errors)

        return response

    def on_language_server_comm_opened(self, comm, comm_msg):
        """ Handle a new comm from the client, optionally launch a handler
        """
        handler = CommHandler()
        handler.comm = comm
        handler.initialize(self)

        language_server = comm_msg["metadata"].get("language_server")

        # this is a pre-baked connection
        if language_server:
            handler.open(language_server)
