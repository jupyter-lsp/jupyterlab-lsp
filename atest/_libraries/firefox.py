"""Keywords for working with firefox/geckodriver primitives."""

def make_firefox_options():
    """Create a customized Firefox/geckodriver configuration.

    Future work might include:
    - proxy to ensure no external calls are made
    """
    from selenium.webdriver.firefox.options import Options

    opts = Options()
    opts.set_preference("devtools.console.stdout.content", True)
    return opts
