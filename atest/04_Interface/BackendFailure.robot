*** Settings ***
Suite Setup       Setup Server and Browser    server_extension_enabled=${False}
Resource          ../Keywords.robot

*** Variables ***
${STATUSBAR}      css:div.lsp-statusbar-item
${POPOVER}        css:.lsp-popover

*** Test Cases ***
Handles Server Extension Failure
    Setup Notebook    Python    Python.ipynb    wait=${False}
    Element Should Contain    ${STATUSBAR}    Server extension missing
    Click Element    ${STATUSBAR}
    Wait For Dialog
    Accept Default Dialog Option
    Page Should Not Contain Element    ${POPOVER}
    [Teardown]    Clean Up After Working With File    Python.ipynb
