*** Settings ***
Suite Setup       Setup Suite For Screenshots    settings
Resource          keywords/Common.robot

*** Test Cases ***
Settings
    Open in Advanced Settings    ${LSP PLUGIN ID}
    Capture Page Screenshot    01-settings-lsp.png
