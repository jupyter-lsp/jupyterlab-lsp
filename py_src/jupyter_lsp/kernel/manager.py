from ..manager import LanguageServerManager
from ..schema import SERVERS_RESPONSE
from .handlers import CommHandler


class CommLanguageServerManager(LanguageServerManager):
    CONTROL_COMM_TARGET = "jupyter.lsp.control"
    LANGUAGE_SERVER_COMM_TARGET = "jupyter.lsp.language_server"

    @property
    def log(self):
        return self.parent.log

    @property
    def comm_manager(self):
        return self.parent.comm_manager

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
