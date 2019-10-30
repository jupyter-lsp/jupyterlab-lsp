import json
import pathlib

import jsonschema

HERE = pathlib.Path(__file__).parent


def servers_schema():
    return jsonschema.validators.Draft7Validator(
        json.loads((HERE / "servers.schema.json").read_text())
    )
