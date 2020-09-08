*** Settings ***
Documentation     Configuration of client-side Completion settings
Suite Setup       Setup Suite For Screenshots    ${SCREENS}
Force Tags        settings:completion    feature:completion    settings-ui:advanced
Resource          ../keywords/Completion.robot
Test Setup        Setup Completion Test
Test Teardown     Clean Up Completion Test

*** Variables ***
${SCREENS}        settings-completion

*** Test Cases ***
Material Theme Works
    Configure JupyterLab Plugin    {"theme": "material"}    ${COMPLETION PLUGIN ID}
    Capture Page Screenshot    01-configured.png
    Enter Cell Editor    1    line=2
    Trigger Completer
    Capture Page Screenshot    02-completions-shown.png
    # TabError is a builtin exception which is a class in Python,
    # so we should get lsp:material-themed-class icon:
    Completer Should Suggest    TabError
    Completer Should Include Icon    lsp:material-themed-class

VSCode Unthemed Works
    Configure JupyterLab Plugin    {"theme": "vscode", "colorScheme": "unthemed"}    ${COMPLETION PLUGIN ID}
    Capture Page Screenshot    01-configured.png
    Enter Cell Editor    1    line=2
    Trigger Completer
    Capture Page Screenshot    02-completions-shown.png
    Completer Should Suggest    TabError
    Completer Should Include Icon    lsp:vscode-unthemed-class

VSCode Muted Works
    ${file} =    Set Variable    Completion.ipynb
    Lab Command    Use JupyterLab Dark Theme
    Wait For Splash
    Capture Page Screenshot    00-theme-changed.png
    Configure JupyterLab Plugin    {"theme": "vscode", "colorScheme": "muted"}    ${COMPLETION PLUGIN ID}
    Capture Page Screenshot    01-configured.png
    Open ${file} in ${MENU NOTEBOOK}
    Enter Cell Editor    1    line=2
    Wait Until Fully Initialized
    Trigger Completer
    Capture Page Screenshot    02-completions-shown.png
    Completer Should Suggest    TabError
    Completer Should Include Icon    lsp:vscode-muted-class
    Lab Command    Use JupyterLab Light Theme
    Wait For Splash

Works Without A Theme
    Configure JupyterLab Plugin    {"theme": null}    ${COMPLETION PLUGIN ID}
    Capture Page Screenshot    01-configured.png
    Enter Cell Editor    1    line=2
    Trigger Completer
    Capture Page Screenshot    02-completions-shown.png
    Completer Should Suggest    TabError
    Wait Until Page Contains Element    ${CSS COMPLETER BOX} .jp-Completer-monogram

Works With Incorrect Theme
    Configure JupyterLab Plugin    {"theme": "a-non-existing-theme"}    ${COMPLETION PLUGIN ID}
    Capture Page Screenshot    01-configured.png
    Enter Cell Editor    1    line=2
    Trigger Completer
    Capture Page Screenshot    02-completions-shown.png
    Completer Should Suggest    TabError
    Wait Until Page Contains Element    ${CSS COMPLETER BOX} .jp-Completer-monogram
