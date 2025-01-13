from .utils import ShellSpec
from typing import Union

TROUBLESHOOT = """\
You probably just need to install either *gopls* or the *jupyter-gopls*
just use the commands below.
"""


class GoLanguageServer(ShellSpec):
    key = cmd = "gopls"
    package = "jupyter_gopls" # Package with parser for golang
    args = ["serve"]
    is_installed_args = ["version"]
    languages = ["go"]

    spec = dict(
        display_name=key,
        mime_types=["text/x-go", "text/go"],
        urls=dict(
            home="https://pkg.go.dev/golang.org/x/tools/gopls",
        ),
        # config_schema=load_config_schema(key), # TODO Find this options for this server
        troubleshoot=TROUBLESHOOT,
        shadow_file_ext=".go", # Not implemented yet, may be removed in future. See issue #872
        install=dict(
            go="go get golang.org/x/tools/gopls@latest", # This may never change
            pip="pip install {}".format(package), # This package is not published yet
        )
    )
    
    def solve(self) -> Union[str, None]:
        # Check if python package is installed
        pkg = __import__(self.package)
        if not pkg:
            return
        return super().solve()
    
