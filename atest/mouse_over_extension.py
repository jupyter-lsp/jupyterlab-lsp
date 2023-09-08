from robot.libraries.BuiltIn import BuiltIn
from selenium.webdriver.common.actions.action_builder import ActionBuilder
from selenium.webdriver.common.keys import Keys
from SeleniumLibrary import SeleniumLibrary


def wiggle(action, x_wiggle):
    if x_wiggle:
        #action.pointer_action.move_by(xoffset=x_wiggle, yoffset=0)
        action.key_action.pause()
        #action.pointer_action.move_by(xoffset=-x_wiggle, yoffset=0)
        action.key_action.pause()


def mouse_over_token_with_control(token_locator, x_wiggle=0):
    sl: SeleniumLibrary = BuiltIn().get_library_instance("SeleniumLibrary")
    location = _find_text_in_line(token_locator)
    action = ActionBuilder(sl.driver)

    action.key_action.key_down(Keys.CONTROL)
    #action.pointer_action.pause()
    action.pointer_action.move_to_location(location['x'], location['y'])
    wiggle(action, x_wiggle)
    action.key_action.key_up(Keys.CONTROL)

    return action.perform()


def mouse_over_token_and_wiggle(token_locator, x_wiggle=5):
    sl: SeleniumLibrary = BuiltIn().get_library_instance("SeleniumLibrary")
    action = ActionBuilder(sl.driver)
    location = _find_text_in_line(token_locator)
    action.pointer_action.move_to_location(location['x'], location['y'])
    wiggle(action, x_wiggle)
    return action.perform()


def _find_text_in_line(token_locator: str):
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
        """
    )
    return sl.driver.execute_script(
        """
        const text = arguments[0];

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

        return {
            // selenium does not allow passing bare nodes, only elements
            parentElement: subNode.parentElement,
            x: (rect.left + rect.right) / 2,
            y: (rect.top + rect.bottom) / 2
        }
        """,
        text
    )

def _emit_over_text_in_line(token_locator: str, event: str):
    sl: SeleniumLibrary = BuiltIn().get_library_instance("SeleniumLibrary")
    location = _find_text_in_line(token_locator)
    sl.driver.execute_script(
        """
        const location = arguments[0];
        const eventType = arguments[1];

        const e = new Event(eventType, {bubbles: true});
        e.clientX = location.x;
        e.clientY = location.y;

        location.parentElement.dispatchEvent(e);
        """,
        location,
        event
    )


def mouse_over_token(token_locator: str):
    sl: SeleniumLibrary = BuiltIn().get_library_instance("SeleniumLibrary")
    action = ActionBuilder(sl.driver)
    location = _find_text_in_line(token_locator)
    action.pointer_action.move_to_location(location['x'], location['y'])
    return action.perform()


def click_token(token_locator: str):
    return _emit_over_text_in_line(token_locator, event='click')


def open_context_menu_over_token(token_locator: str):
    return _emit_over_text_in_line(token_locator, event='contextmenu')
