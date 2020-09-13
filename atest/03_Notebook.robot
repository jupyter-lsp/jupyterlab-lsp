*** Settings ***
Suite Setup       Setup Suite For Screenshots    notebook
Test Setup        Try to Close All Tabs
Resource          Keywords.robot

*** Variables ***
${COMPLETER_BOX}    css:.jp-Completer.jp-HoverBox

*** Test Cases ***
Python
    [Setup]    Setup Notebook    Python    Python.ipynb
    ${diagnostic} =    Set Variable    W291 trailing whitespace (pycodestyle)
    Wait Until Page Contains Element    css:.cm-lsp-diagnostic[title="${diagnostic}"]    timeout=35s
    Capture Page Screenshot    01-python.png
    [Teardown]    Clean Up After Working With File    Python.ipynb

Foreign Extractors
    ${file} =    Set Variable    Foreign extractors.ipynb
    Configure JupyterLab Plugin
    ...    {"language_servers": {"texlab": {"serverSettings": {"latex.lint.onChange": true}}}}
    Capture Page Screenshot    10-configured.png
    Reset Application State
    Setup Notebook    Python    ${file}
    @{diagnostics} =    Create List
    ...    Failed to parse expression    # bash
    ...    ame 'valid'    # python, mypy and pyflakes will fight over `(N|n)ame 'valid'`, just hope for the best
    ...    Trailing whitespace is superfluous.    # r
    ...    `frob` is misspelt    # markdown
    ...    Command terminated with space    # latex
    FOR    ${diagnostic}    IN    @{diagnostics}
        Wait Until Page Contains Element    css:.cm-lsp-diagnostic[title*\="${diagnostic}"]    timeout=35s
    END
    Capture Page Screenshot    11-extracted.png
    [Teardown]    Clean Up After Working with File and Settings    ${file}

Code Overrides
    ${file} =    Set Variable    Code overrides.ipynb
    Setup Notebook    Python    ${file}
    ${virtual_path} =    Set Variable    ${OUTPUT DIR}${/}home${/}.virtual_documents/Code\ overrides.ipynb
    Wait Until Created    ${virtual_path}
    ${document} =    Get File    ${virtual_path}
    Should Be Equal    ${document}    get_ipython().run_line_magic("ls", "")\n\n\nget_ipython().run_line_magic("pip", " freeze")\n

Performance
    ${file} =    Set Variable    Medium_long_notebook.ipynb
    Setup Notebook    Python    ${file}
    Enter Cell Editor    48    9
    Capture Page Screenshot    01-in-cell.png
    ${start_time} =    Get Time    epoch
    Press Keys    None    add
    Trigger Completer
    Completer Should Suggest    add_together
    ${end_time} =    Get Time    epoch
    ${elapsed} =    Evaluate    ${end_time} - ${start_time}
    Should Be True    ${elapsed} < 10
    Capture Page Screenshot    03-completer.png

*** Keywords ***
# TODO reuse the completion keywords as soon as #328 merged and split up keywords from tests then
Completer Should Suggest
    [Arguments]    ${text}
    Wait Until Page Contains Element    ${COMPLETER_BOX} .jp-Completer-item[data-value="${text}"]    timeout=10s
    Capture Page Screenshot    ${text.replace(' ', '_')}.png

Trigger Completer
    Press Keys    None    TAB
    Wait Until Page Contains Element    ${COMPLETER_BOX}    timeout=35s
