"""Keywords for working with firefox/geckodriver primitives."""

def make_firefox_options():
    """Create a customized Firefox/geckodriver configuration.

    Future work might include:
    - proxy to ensure no external calls are made
    """
    from selenium.webdriver.firefox.options import Options

    opts = Options()
    opts.set_preference("devtools.console.stdout.content", True)
    # Reduce per-test browser overhead and disable unnecessary startup checks
    opts.set_preference("dom.ipc.processCount", 1)
    opts.set_preference("dom.ipc.processCount.webIsolated", 1)
    opts.set_preference("network.captive-portal-service.enabled", False)
    opts.set_preference("network.connectivity-service.enabled", False)
    opts.set_preference("browser.sessionstore.resume_from_crash", False)
    opts.set_preference("browser.newtabpage.enabled", False)
    return opts
