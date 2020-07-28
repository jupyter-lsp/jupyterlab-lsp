from .config import load_config_schema
from .utils import ShellSpec


class Texlab(ShellSpec):
    cmd = key = "texlab"
    languages = ["tex", "latex"]
    spec = dict(
        display_name="texlab",
        mime_types=["text/x-latex", "text/x-tex"],
        urls=dict(
            home="https://texlab.netlify.app",
            issues="https://github.com/latex-lsp/texlab/issues",
        ),
        install=dict(conda="conda install -c conda-forge texlab chktex"),
        config_schema=load_config_schema(key),
        env=dict(RUST_BACKTRACE="1"),
    )
