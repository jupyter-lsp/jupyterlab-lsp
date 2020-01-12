*** Settings ***
Suite Setup       Set Screenshot Directory    ${OUTPUT DIR}${/}screenshots${/}smoke
Resource          Keywords.robot

*** Test Cases ***
Lab Version
    Capture Page Screenshot    00-smoke.png

Root URI
    [Documentation]    the rootUri should be set in the page config
    Should Not Be Empty    ${PAGE CONFIG["rootUri"]}
