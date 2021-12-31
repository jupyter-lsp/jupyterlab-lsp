*** Settings ***
Suite Setup       Setup Suite For Screenshots    diagnostics
Force Tags        feature:diagnostics
Test Setup        Setup Notebook    Python    Diagnostic.ipynb
Test Teardown     Clean Up After Working With File    Diagnostic.ipynb
Resource          ../Keywords.robot
# note: diagnostics are also tested in 01_Editor and 04_Interface/DiagnosticsPanel.robot

*** Test Cases ***
Diagnostics with deprecated tag have strike-through decoration
    Wait Until Page Contains Element    css:.cm-lsp-diagnostic[title*="is deprecated"]    timeout=25s
    Page Should Contain Element    css:.cm-lsp-diagnostic-tag-Deprecated
