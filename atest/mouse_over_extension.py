from robot.libraries.BuiltIn import BuiltIn
from selenium.webdriver import ActionChains
from selenium.webdriver.common.keys import Keys
from SeleniumLibrary import SeleniumLibrary


def wiggle(action_chains, x_wiggle):
    if x_wiggle:
        action_chains.move_by_offset(xoffset=x_wiggle, yoffset=0)
        action_chains.move_by_offset(xoffset=-x_wiggle, yoffset=0)


def mouse_over_with_control(locator, x_wiggle=0):
    sl: SeleniumLibrary = BuiltIn().get_library_instance("SeleniumLibrary")
    action_chains = ActionChains(sl.driver)
    action_chains.key_down(Keys.CONTROL)
    action_chains.move_to_element(sl.find_element(locator))
    wiggle(action_chains, x_wiggle)
    action_chains.key_up(Keys.CONTROL)
    return action_chains.perform()


def mouse_over_and_wiggle(locator, x_wiggle=5):
    sl: SeleniumLibrary = BuiltIn().get_library_instance("SeleniumLibrary")
    action_chains = ActionChains(sl.driver)
    action_chains.move_to_element(sl.find_element(locator))
    wiggle(action_chains, x_wiggle)
    return action_chains.perform()
