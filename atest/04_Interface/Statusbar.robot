*** Settings ***
Suite Setup       Setup Suite For Screenshots    statusbar
Resource          ../Keywords.robot

*** Variables ***
${STATUSBAR}      css:div.lsp-statusbar-item
${DIAGNOSTIC}     W291 trailing whitespace (pycodestyle)
${POPOVER}        css:.lsp-popover
${HELP_BUTTON}    css:.lsp-popover .lsp-help-button

*** Test Cases ***
Statusbar Popup Opens
    Setup Notebook    Python    Python.ipynb
    Wait Until Page Contains Element    css:.cm-lsp-diagnostic[title*="${DIAGNOSTIC}"]    timeout=20s
    Element Should Contain    ${STATUSBAR}    Fully initialized
    Click Element    ${STATUSBAR}
    Wait Until Page Contains Element    ${POPOVER}    timeout=10s
    Capture Page Screenshot    01-statusbar.png
    Element Should Contain    ${POPOVER}    python
    Element Should Contain    ${POPOVER}    initialized
    [Teardown]    Clean Up After Working With File    Python.ipynb

Troubleshooting And Help Is Offered For Known Non-Installed Servers
    [Documentation]    When specification of a language server has been configured or provided, but the server is not installed (or detected) the user should get help on installation and/or troubleshooting
    Prepare File for Editing    Python    status    example.klingon
    Wait Until Element Contains    ${STATUSBAR}    Initialized (additional servers needed)    timeout=60s
    Click Element    ${STATUSBAR}
    Wait Until Page Contains Element    ${POPOVER}    timeout=10s
    Page Should Contain Element    ${HELP_BUTTON}
    # sanity check
    Page Should Not Contain    run-klingon-language-server not found.
    Click Element    ${HELP_BUTTON}
    Wait For Dialog
    # info message should get generated
    Page Should Contain    There is 1 language server you can easily install that supports klingon.
    # provided links should be shown
    Page Should Contain    https://en.wikipedia.org/wiki/Klingon_language
    # automated shellspec troubleshooting should get generates
    Page Should Contain    run-klingon-language-server not found.
    # specification-provided troubeshooting should be shown too
    Page Should Contain    This is just a test language server.
    # installation command should be shown
    Page Should Contain    echo "This language server cannot be installed."
    [Teardown]    Clean Up After Working With File    example.klingon

Status Changes Between Notebooks
    Setup Notebook    Python    Python.ipynb
    Wait Until Fully Initialized
    Open New Notebook
    Element Should Contain    ${STATUSBAR}    Waiting...
    Wait Until Fully Initialized
    Switch To Tab    Python.ipynb
    Wait Until Fully Initialized
    [Teardown]    Clean Up After Working With File    Python.ipynb

Status Changes Correctly Between Editors
    Prepare File for Editing    Python    status    example.py
    Wait Until Fully Initialized
    Open File    example.plain
    Wait Until Element Contains    ${STATUSBAR}    Initialized (additional servers needed)    timeout=60s
    Capture Page Screenshot    01-both-open.png
    Switch To Tab    example.py
    Wait Until Fully Initialized
    Switch To Tab    example.plain
    Wait Until Element Contains    ${STATUSBAR}    Initialized (additional servers needed)    timeout=60s
    [Teardown]    Clean Up After Working With File    example.plain

*** Keywords ***
Switch To Tab
    [Arguments]    ${file}
    Click Element    ${JLAB XP DOCK TAB}\[contains(., '${file}')]
