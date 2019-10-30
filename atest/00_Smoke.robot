*** Settings ***
Suite Setup       Set Screenshot Directory    ${OUTPUT DIR}${/}screenshots${/}smoke
Resource          Keywords.robot

*** Test Cases ***
Smoke
    Capture Page Screenshot    00-splash.png

Settings
    [Setup]    Reset Application State
    Lab Command    Advanced Settings Editor
    Capture Page Screenshot    01-settings-all.png
    ${sel} =    Set Variable    css:[data-id="@krassowski/jupyterlab-lsp:plugin"]
    Wait Until Page Contains Element    ${sel}
    Click Element    ${sel}
    Wait Until Page Contains    System Defaults
    Capture Page Screenshot    02-settings-lsp.png
