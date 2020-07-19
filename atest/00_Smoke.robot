*** Settings ***
Suite Setup       Set Screenshot Directory    ${OUTPUT DIR}${/}screenshots${/}smoke
Resource          Keywords.robot

*** Test Cases ***
Lab Version
    Capture Page Screenshot    00-smoke.png

Build Skipped
    [Documentation]    Pre-flight the page config
    Should Be Equal    ${PAGE CONFIG["buildCheck"]}    ${False}
    Should Be Equal    ${PAGE CONFIG["buildAvailable"]}    ${false}
