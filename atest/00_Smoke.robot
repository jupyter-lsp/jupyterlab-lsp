*** Settings ***
Resource        Keywords.resource

Suite Setup     Set Screenshot Directory    ${SCREENSHOTS DIR}${/}smoke


*** Test Cases ***
Lab Version
    Capture Page Screenshot    00-smoke.png

Root URI
    [Documentation]    the rootUri should be set in the page config
    Should Not Be Empty    ${PAGE CONFIG["rootUri"]}

Build Skipped
    [Documentation]    Pre-flight the page config
    Should Be Equal    ${PAGE CONFIG["buildCheck"]}    ${False}
    Should Be Equal    ${PAGE CONFIG["buildAvailable"]}    ${false}
