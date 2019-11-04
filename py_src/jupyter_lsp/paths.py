import re

RE_WIN_PATH = r"^file:///([A-Z]):/"


def normalize_uri(root_uri):
    if not re.findall(RE_WIN_PATH, root_uri):
        return root_uri
    return re.sub(
        RE_WIN_PATH, lambda m: "file:///{}:/".format(m.group(1).lower()), root_uri
    )
