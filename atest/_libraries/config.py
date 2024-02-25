"""work with jupyter config"""

import json
from pathlib import Path

ENC = dict(encoding="utf-8")


def update_jupyter_config(path, has_traits, **key_values):
    """update an existing jupyter_server_config.json"""
    p = Path(path)
    conf = json.loads(p.read_text(**ENC))

    for key, value in key_values.items():
        conf.setdefault(has_traits, {})[key] = value

    p.write_text(json.dumps(conf, indent=2, sort_keys=True), **ENC)
