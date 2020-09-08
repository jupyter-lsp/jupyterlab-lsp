*** Settings ***
Suite Setup       Set Screenshot Directory    ${OUTPUT DIR}${/}screenshots${/}smoke
Resource          keywords/Common.robot

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
