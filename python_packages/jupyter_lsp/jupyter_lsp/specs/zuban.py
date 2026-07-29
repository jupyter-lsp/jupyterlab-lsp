from .config import load_config_schema
from .utils import ShellSpec


class ZubanLanguageServer(ShellSpec):
    key = cmd = "zuban"
    args = ["server"]
    languages = ["python"]
    spec = dict(
        display_name="Zuban",
        mime_types=["text/python", "text/x-ipython"],
        urls=dict(
            home="https://github.com/zubanls/zuban",
            issues="https://github.com/zubanls/zuban/issues",
        ),
        install=dict(
            pip="pip install zuban",
            uv="uv add zuban",
        ),
        config_schema=load_config_schema(key),
        requires_documents_on_disk=False,
    )
