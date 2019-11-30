*** Settings ***
Suite Setup       Setup Suite For Screenshots    settings
Resource          Keywords.robot

*** Test Cases ***
Settings
    [Setup]    Reset Application State
    Lab Command    Advanced Settings Editor
    Capture Page Screenshot    01-settings-all.png
    ${sel} =    Set Variable    css:[data-id="@krassowski/jupyterlab-lsp:plugin"]
    Wait Until Page Contains Element    ${sel}
    Click Element    ${sel}
    Wait Until Page Contains    System Defaults
    Capture Page Screenshot    02-settings-lsp.png
