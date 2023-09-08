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


def _over_text_in_line(token_locator: str, event = None):
    which, text = token_locator.split(':', maxsplit=1)
    assert which == 'lastToken'

    sl: SeleniumLibrary = BuiltIn().get_library_instance("SeleniumLibrary")
    sl.driver.execute_script(
        """
        window.breadthFirstSearchReverse = function (nodes, text) {
          for (let n of nodes.toReversed()) {
            if (n.childNodes.length) {
              var result = window.breadthFirstSearchReverse(
                [...n.childNodes],
               text
              );
              if (result) {
               return result
              }
            } else if (n.textContent.includes(text) && n.nodeType === 3) {
              return n;
            }
          }
        }
        const text = arguments[0];
        const eventType = arguments[1];

        const textNode = window.breadthFirstSearchReverse(
          [...document.querySelectorAll('.cm-line')],
          text
        );

        const offset = textNode.textContent.indexOf(text);
        const subNode = (
          textNode
          .splitText(offset)
          .splitText(text.length)
          .previousSibling
        );
        const range = document.createRange();
        range.selectNode(subNode);
        const rect = range.getBoundingClientRect();

        const e = new Event(eventType, {bubbles: true});
        e.clientX = (rect.left + rect.right) / 2;
        e.clientY = (rect.top + rect.bottom) / 2;

        subNode.parentElement.dispatchEvent(e);
        """,
        text,
        event
    );


def click_token(token_locator: str):
    return _over_text_in_line(token_locator, event='click')


def open_context_menu_over_token(token_locator: str):
    return _over_text_in_line(token_locator, event='contextmenu')
