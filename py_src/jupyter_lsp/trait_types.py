import traitlets


class Schema(traitlets.Any):
    """ any... but validated by a jsonschema.Validator
    """

    _validator = None

    def __init__(self, validator, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._validator = validator

    def validate(self, obj, value):
        errors = list(self._validator.iter_errors(value))
        if errors:
            raise traitlets.TraitError(
                ("""schema errors:\n""" """\t{}\n""" """for:\n""" """{}""").format(
                    "\n\t".join([error.message for error in errors]), value
                )
            )
        return value
