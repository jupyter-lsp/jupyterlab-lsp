import os

from jupyter_core.paths import jupyter_config_path
from notebook.services.config import ConfigManager
from traitlets import Instance, default

from ..manager import LanguageServerManager
from ..schema import SERVERS_RESPONSE
from .handlers import CommHandler


class CommLanguageServerManager(LanguageServerManager):
    CONTROL_COMM_TARGET = "jupyter.lsp.control"
    LANGUAGE_SERVER_COMM_TARGET = "jupyter.lsp.language_server"

    config_manager = Instance(ConfigManager)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._load_extra_config()

    @property
    def log(self):
        return self.parent.log

    @property
    def comm_manager(self):
        return self.parent.comm_manager

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
        from_config = (
            self.config_manager.get("jupyter_notebook_config").get(
                "LanguageServerManager"
            )
            or {}
        )
        traits = self.trait_names()
        for key, value in from_config.items():
            if key in traits:
                setattr(self, key, value)

    def initialize(self, *args, **kwargs):
        super().initialize(*args, **kwargs)
        self.init_comm_targets()

    def init_comm_targets(self):
        self.comm_manager.register_target(
            self.CONTROL_COMM_TARGET, self.on_control_comm_opened
        )
        self.comm_manager.register_target(
            self.LANGUAGE_SERVER_COMM_TARGET, self.on_language_server_comm_opened
        )

    def on_control_comm_opened(self, comm, comm_msg):
        self.send_status(comm)

    def send_status(self, comm):
        response = {
            "version": 2,
            "sessions": {
                language_server: session.to_json()
                for language_server, session in self.sessions.items()
            },
        }

        errors = list(SERVERS_RESPONSE.iter_errors(response))

        if errors:  # pragma: no cover
            self.log.warn("{} validation errors: {}", len(errors), errors)

        comm.send(response)

    def on_language_server_comm_opened(self, comm, comm_msg):
        language_server = comm_msg["metadata"]["language_server"]

        handler = CommHandler()
        handler.comm = comm
        handler.initialize(self)
        handler.open(language_server)
