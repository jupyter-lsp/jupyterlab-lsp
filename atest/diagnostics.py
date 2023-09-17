from functools import partial
from robot.libraries.BuiltIn import BuiltIn
from selenium.common.exceptions import NoSuchElementException, TimeoutException
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from SeleniumLibrary import SeleniumLibrary

from robot.utils import timestr_to_secs

DIAGNOSTIC_CLASS = 'cm-lintRange'

def page_contains_diagnostic(driver: WebDriver, selector, negate=False):
    elements = driver.find_elements(By.CSS_SELECTOR, f'.{DIAGNOSTIC_CLASS}')
    if not elements:
        return True if negate else False
    driver.execute_script("""
    arguments[0].map(el => {
      let diagnostic = el.cmView.mark.spec.diagnostic;
      el.title = diagnostic.message + " (" + diagnostic.source + ")";
    });
    """, elements)
    try:
        driver.find_element(By.CSS_SELECTOR, f'.{DIAGNOSTIC_CLASS}{selector}')
    except NoSuchElementException:
        return True if negate else False
    return False if negate else True


def wait_until_page_contains_diagnostic(selector, timeout='5s'):
    sl: SeleniumLibrary = BuiltIn().get_library_instance("SeleniumLibrary")
    wait = WebDriverWait(sl.driver, timestr_to_secs(timeout))
    try:
        return wait.until(
            partial(page_contains_diagnostic, selector=selector)
        )
    except TimeoutException:
        elements = sl.driver.find_elements(By.CSS_SELECTOR, f'.{DIAGNOSTIC_CLASS}')
        if elements:
            titles = (
              '\n - '
              + '\n - '.join([el.get_attribute('title') for el in elements])
            )
            hint = f'Visible diagnostics are: {titles}'
        else:
            hint = 'No diagnostics were visible.'
        raise TimeoutException(
            f'Diagnostic with selector {selector} not found in {timeout}.'
            f'\n{hint}'
        )


def wait_until_page_does_not_contain_diagnostic(selector, timeout='5s'):
    sl: SeleniumLibrary = BuiltIn().get_library_instance("SeleniumLibrary")
    wait = WebDriverWait(sl.driver, timestr_to_secs(timeout))
    return wait.until(
        partial(page_contains_diagnostic, selector=selector, negate=True),
        f'Diagnostic with selector {selector} still present after {timeout}'
    )
