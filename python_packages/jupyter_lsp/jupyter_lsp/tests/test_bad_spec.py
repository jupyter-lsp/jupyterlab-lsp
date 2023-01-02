import pytest
import traitlets

from jupyter_lsp.schema import SPEC_VERSION
from jupyter_lsp.session import LanguageServerSessionStdio


@pytest.mark.parametrize(
    "spec",
    [
        {},
        {"argv": [], "languages": []},
        {"languages": None},
        {"languages": 1},
        {"languages": [1, "two"]},
        {
            "argv": ["command"],
            "languages": ["some language"],
            "version": SPEC_VERSION,
            "mode": "unknown",
        },
    ],
)
def test_bad_spec(spec):
    with pytest.raises(traitlets.TraitError):
        LanguageServerSessionStdio(spec=spec)
