*** Settings ***
Suite Setup       Setup Suite For Screenshots    settings
Resource          Keywords.robot

*** Test Cases ***
Settings
    [Setup]    Reset Application State
    Open in Advanced Settings    ${LSP PLUGIN ID}
    Capture Page Screenshot    01-settings-lsp.png
