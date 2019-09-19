def server_process_config() -> dict:
    """ Return the jupyter-server-proxy configuration object
    """
    return dict(
        command=["jupyter-lsproxy", "--port", "{port}"]
    )
