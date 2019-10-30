import json
import pathlib

import jsonschema

HERE = pathlib.Path(__file__).parent


def servers_schema() -> jsonschema.validators.Draft7Validator:
    """ return a JSON Schema Draft 7 validator for the server status API
    """
    return jsonschema.validators.Draft7Validator(
        json.loads((HERE / "servers.schema.json").read_text())
    )
