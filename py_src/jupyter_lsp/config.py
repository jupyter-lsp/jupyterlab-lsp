def server_process_config() -> dict:  # pragma: no cover
    """ Return the jupyter-server-proxy configuration object
    """
    return dict(command=["jupyter-lsproxy", "--port", "{port}"])
