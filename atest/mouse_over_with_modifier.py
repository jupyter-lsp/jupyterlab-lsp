from robot.api import logger
from robot.libraries.BuiltIn import BuiltIn
from selenium.webdriver import ActionChains
from selenium.webdriver.common.keys import Keys
from SeleniumLibrary import SeleniumLibrary


def mouse_over_with_control(locator, x_wiggle=0):
    logger.info("Getting currently open browser desired capabilities")
    sl: SeleniumLibrary = BuiltIn().get_library_instance("SeleniumLibrary")
    action_chains = ActionChains(sl.driver)
    action_chains.key_down(Keys.CONTROL)
    action_chains.move_to_element(sl.find_element(locator))
    if x_wiggle:
        action_chains.move_by_offset(xoffset=x_wiggle, yoffset=0)
        action_chains.move_by_offset(xoffset=-x_wiggle, yoffset=0)
    action_chains.key_up(Keys.CONTROL)
    return action_chains.perform()
