import traitlets
from ipykernel.comm import Comm

from ..manager import LanguageServerManager
from ..schema import SERVERS_RESPONSE
from .handlers import CommHandler


class CommLanguageServerManager(LanguageServerManager):
    CONTROL_COMM_TARGET = "jupyter.lsp.control"
    LANGUAGE_SERVER_COMM_TARGET = "jupyter.lsp.language_server"

    _lsp_comms = traitlets.Dict()

    @traitlets.default("_lsp_comms")
    def _default_lsp_comms(self):
        return {}

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
        self.comm_manager.register_target(self.CONTROL_COMM_TARGET, self.on_control_comm_opened)
        self.comm_manager.register_target(self.LANGUAGE_SERVER_COMM_TARGET, self.on_language_server_comm_opened)
        self.log.error("comm targets registered: {}".format([self.CONTROL_COMM_TARGET, self.LANGUAGE_SERVER_COMM_TARGET]))

    def on_control_comm_opened(self, comm, comm_msg):
        self.log.error("[{}] control comm opened: {}".format(comm, comm_msg))
        self.send_status(comm)
        # nb: when should we update?

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
        self.log.error("[{}] language server comm requested: {}".format(comm, comm_msg))
        language_server = comm_msg["metadata"]["language_server"]

        self._lsp_comms[language_server] = CommHandler(
            language_server=language_server,
            comm=comm,
            manager=self
        )
