""" handle jupyter config
"""
import json
from pathlib import Path

NO_BUILD = {
    "LabApp": {
        "tornado_settings": {
            "page_config_data": {"buildCheck": False, "buildAvailable": False}
        }
    }
}


def initialize_server_config(home, root):
    """ make a notebook server config file
    """
    config = dict(LanguageServerManager=dict(extra_node_roots=[root]), **NO_BUILD)

    (Path(home) / "jupyter_notebook_config.json").write_text(
        json.dumps(config, indent=2, sort_keys=True)
    )
