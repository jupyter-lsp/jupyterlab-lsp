"""work with jupyter paths"""

from jupyterlab.commands import get_app_dir


def get_jupyterlab_path():
    """Get JupyterLab Application Directory path"""
    return get_app_dir()
