*** Settings ***
Suite Setup       Setup Suite For Screenshots    completion
Test Setup        Setup Completion Test
Test Teardown     Clean Up After Working With File    Completion.ipynb
Force Tags        feature:completion
Resource          ../Keywords.robot

*** Variables ***
${COMPLETER_BOX}    css:.jp-Completer.jp-HoverBox
${DOCUMENTATION_PANEL}    css:.jp-Completer-docpanel
${KERNEL_BUSY_INDICATOR}    css:.jp-NotebookPanel-toolbar div[title="Kernel Busy"]

*** Test Cases ***
Works When Kernel Is Idle
    Configure JupyterLab Plugin    {"kernelResponseTimeout": -1, "waitForBusyKernel": false}    plugin id=${COMPLETION PLUGIN ID}
    [Documentation]    The suggestions from kernel and LSP should get integrated.
    Enter Cell Editor    1    line=2
    Capture Page Screenshot    01-entered-cell.png
    Trigger Completer
    Capture Page Screenshot    02-completions-shown.png
    # lowercase and uppercase suggestions:
    Completer Should Suggest    TabError
    # this comes from LSP:
    Completer Should Suggest    test
    # this comes from kernel
    Completer Should Suggest    %%timeit
    Press Keys    None    ENTER
    Capture Page Screenshot    03-completion-confirmed.png
    ${content} =    Get Cell Editor Content    1
    Should Contain    ${content}    TabError

Can Prioritize Kernel Completions
    Configure JupyterLab Plugin    {"kernelCompletionsFirst": true, "kernelResponseTimeout": -1}    plugin id=${COMPLETION PLUGIN ID}
    Enter Cell Editor    1    line=2
    Trigger Completer
    Completer Should Suggest    %%timeit
    ${lsp_position} =    Get Completion Item Vertical Position    test
    ${kernel_position} =    Get Completion Item Vertical Position    %%timeit
    Should Be True    ${kernel_position} < ${lsp_position}

Can Prioritize LSP Completions
    Configure JupyterLab Plugin    {"kernelCompletionsFirst": false, "kernelResponseTimeout": -1}    plugin id=${COMPLETION PLUGIN ID}
    Enter Cell Editor    1    line=2
    Trigger Completer
    Completer Should Suggest    %%timeit
    ${lsp_position} =    Get Completion Item Vertical Position    test
    ${kernel_position} =    Get Completion Item Vertical Position    %%timeit
    Should Be True    ${kernel_position} > ${lsp_position}

Invalidates On Cell Change
    Enter Cell Editor    1    line=2
    Press Keys    None    TAB
    Enter Cell Editor    2
    # just to increase chances of caching this on CI (which is slow)
    Sleep    5s
    Completer Should Not Suggest    test

Invalidates On Focus Loss
    Enter Cell Editor    1    line=2
    Press Keys    None    TAB
    Enter Cell Editor    2
    # just to increase chances of caching this on CI (which is slow)
    Sleep    5s
    Completer Should Not Suggest    test

Uses LSP Completions When Kernel Resoponse Times Out
    Configure JupyterLab Plugin    {"kernelResponseTimeout": 1, "waitForBusyKernel": true}    plugin id=${COMPLETION PLUGIN ID}
    Should Complete While Kernel Is Busy

Uses LSP Completions When Kernel Is Busy
    [Documentation]    When kernel is not available the best thing is to show some suggestions (LSP) rather than none.
    Configure JupyterLab Plugin    {"kernelResponseTimeout": -1, "waitForBusyKernel": false}    plugin id=${COMPLETION PLUGIN ID}
    Should Complete While Kernel Is Busy

Works When Kernel Is Shut Down
    Lab Command    Shut Down All Kernels…
    Wait For Dialog
    Capture Page Screenshot    01-shutting-kernels.png
    Accept Default Dialog Option
    Capture Page Screenshot    02-kernels-shut.png
    Enter Cell Editor    1    line=2
    Trigger Completer
    Capture Page Screenshot    03-completions-shown.png
    # this comes from LSP:
    Completer Should Suggest    test
    # this comes from kernel:
    Completer Should Not Suggest    %%timeit

Works After Kernel Restart In New Cells
    Restart Kernel
    Enter Cell Editor    1    line=2
    # works in old cells
    Trigger Completer
    Completer Should Suggest    test
    Lab Command    Insert Cell Below
    Enter Cell Editor    2    line=1
    # works in new cells
    Press Keys    None    lis
    Trigger Completer
    Completer Should Suggest    list

Works In File Editor
    [Setup]    Prepare File for Editing    Python    completion    completion.py
    Place Cursor In File Editor At    9    2
    Wait Until Fully Initialized
    Trigger Completer
    Completer Should Suggest    add
    [Teardown]    Clean Up After Working With File    completion.py

Completes In Strings Or Python Dictionaries
    [Setup]    Prepare File for Editing    Python    completion    completion.py
    Place Cursor In File Editor At    16    0
    Wait Until Fully Initialized
    Press Keys    None    test_dict['']
    Place Cursor In File Editor At    16    11
    Trigger Completer
    # note: in jedi-language-server this would be key_a without '
    Completer Should Suggest    'key_a
    Select Completer Suggestion    'key_a
    Wait Until Keyword Succeeds    40x    0.5s    File Editor Line Should Equal    15    test_dict['key_a']
    [Teardown]    Clean Up After Working With File    completion.py

Continious Hinting Works
    Configure JupyterLab Plugin    {"continuousHinting": true}    plugin id=${COMPLETION PLUGIN ID}
    Prepare File for Editing    Python    completion    completion.py
    Place Cursor In File Editor At    9    2
    Capture Page Screenshot    01-editor-ready.png
    Press Keys    None    d
    Completer Should Suggest    addition
    # gh430 - auto invoke after dot should work too
    Press Keys    None    .
    Completer Should Suggest    __doc__

Autocompletes If Only One Option
    Enter Cell Editor    3    line=1
    Press Keys    None    cle
    # First tab brings up the completer
    Press Keys    None    TAB
    Completer Should Suggest    clear
    # Second tab inserts the only suggestion
    Press Keys    None    TAB
    # depends on Python list type having only one method with prefix "cle"
    Wait Until Keyword Succeeds    40x    0.5s    Cell Editor Should Equal    3    list.clear

Does Not Autocomplete If Multiple Options
    Enter Cell Editor    3    line=1
    Press Keys    None    c
    # First tab brings up the completer
    Press Keys    None    TAB
    Completer Should Suggest    copy
    # Second tab inserts should not insert the first of many choices.
    Press Keys    None    TAB
    # depends on Python list type having multiple methods with prefix "c"
    # in this case "Completer Should Suggest" means that the completer is still shown!
    Completer Should Suggest    copy

User Can Select Lowercase After Starting Uppercase
    # `from time import Tim<tab>` → `from time import time`
    Enter Cell Editor    5    line=1
    Trigger Completer
    Completer Should Suggest    time
    Press Keys    None    ENTER
    Wait Until Keyword Succeeds    40x    0.5s    Cell Editor Should Equal    5    from time import time

Mid Token Completions Do Not Overwrite
    # `disp<tab>data` → `display_table<cursor>data`
    Place Cursor In Cell Editor At    9    line=1    character=4
    Capture Page Screenshot    01-cursor-placed.png
    Trigger Completer
    Completer Should Suggest    display_table
    Select Completer Suggestion    display_table
    Capture Page Screenshot    02-completed.png
    Wait Until Keyword Succeeds    40x    0.5s    Cell Editor Should Equal    9    display_tabledata
    # `disp<tab>lay` → `display_table<cursor>`
    Place Cursor In Cell Editor At    11    line=1    character=4
    Trigger Completer
    Completer Should Suggest    display_table
    Select Completer Suggestion    display_table
    Wait Until Keyword Succeeds    40x    0.5s    Cell Editor Should Equal    11    display_table

Completion Works For Tokens Separated By Space
    # `from statistics <tab>` → `from statistics import<cursor>`
    Enter Cell Editor    13    line=1
    Trigger Completer
    Completer Should Suggest    import
    Press Keys    None    ENTER
    Wait Until Keyword Succeeds    40x    0.5s    Cell Editor Should Equal    13    from statistics import

Kernel And LSP Completions Merge Prefix Conflicts Are Resolved
    [Documentation]    Reconciliate Python kernel returning prefixed completions and LSP (pyls) not-prefixed ones
    Configure JupyterLab Plugin    {"kernelResponseTimeout": -1, "waitForBusyKernel": false}    plugin id=${COMPLETION PLUGIN ID}
    # For more details see: https://github.com/krassowski/jupyterlab-lsp/issues/30#issuecomment-576003987
    # `import os.pat<tab>` → `import os.pathsep`
    Enter Cell Editor    15    line=1
    Trigger Completer
    Completer Should Suggest    pathsep
    Select Completer Suggestion    pathsep
    Wait Until Keyword Succeeds    40x    0.5s    Cell Editor Should Equal    15    import os.pathsep

Triggers Completer On Dot
    Enter Cell Editor    2    line=1
    Press Keys    None    .
    Wait Until Keyword Succeeds    10x    0.5s    Cell Editor Should Equal    2    list.
    Wait Until Page Contains Element    ${COMPLETER_BOX}    timeout=35s
    Completer Should Suggest    append

Material Theme Works
    Configure JupyterLab Plugin    {"theme": "material"}    plugin id=${COMPLETION PLUGIN ID}
    Capture Page Screenshot    01-configured.png
    Enter Cell Editor    1    line=2
    Trigger Completer
    Capture Page Screenshot    02-completions-shown.png
    # TabError is a builtin exception which is a class in Python,
    # so we should get lsp:material-class-light icon:
    Completer Should Suggest    TabError
    Completer Should Include Icon    lsp:material-class-light

VSCode Theme Works
    Configure JupyterLab Plugin    {"theme": "vscode"}    plugin id=${COMPLETION PLUGIN ID}
    Capture Page Screenshot    01-configured.png
    Enter Cell Editor    1    line=2
    Trigger Completer
    Capture Page Screenshot    02-completions-shown.png
    Completer Should Suggest    TabError
    Completer Should Include Icon    lsp:vscode-class-light

VSCode Dark Theme Works
    ${file} =    Set Variable    Completion.ipynb
    Lab Command    Use Theme: JupyterLab Dark
    Wait For Splash
    Capture Page Screenshot    00-theme-changed.png
    Configure JupyterLab Plugin    {"theme": "vscode"}    plugin id=${COMPLETION PLUGIN ID}
    Capture Page Screenshot    01-configured.png
    Open ${file} in ${MENU NOTEBOOK}
    Wait Until Fully Initialized
    Enter Cell Editor    1    line=2
    Trigger Completer
    Capture Page Screenshot    02-completions-shown.png
    Completer Should Suggest    TabError
    Completer Should Include Icon    lsp:vscode-class-dark
    Lab Command    Use Theme: JupyterLab Light
    Wait For Splash

Works Without A Theme
    Configure JupyterLab Plugin    {"theme": null}    plugin id=${COMPLETION PLUGIN ID}
    Capture Page Screenshot    01-configured.png
    Enter Cell Editor    1    line=2
    Trigger Completer
    Capture Page Screenshot    02-completions-shown.png
    Completer Should Suggest    TabError
    Wait Until Page Contains Element    ${COMPLETER_BOX} .jp-Completer-monogram

Works With Incorrect Theme
    Configure JupyterLab Plugin    {"theme": "a-non-existing-theme"}    plugin id=${COMPLETION PLUGIN ID}
    Capture Page Screenshot    01-configured.png
    Enter Cell Editor    1    line=2
    Trigger Completer
    Capture Page Screenshot    02-completions-shown.png
    Completer Should Suggest    TabError
    Wait Until Page Contains Element    ${COMPLETER_BOX} .jp-Completer-monogram

Completes Correctly With R Double And Triple Colon
    [Setup]    Prepare File for Editing    R    completion    completion.R
    Place Cursor In File Editor At    2    7
    Wait Until Fully Initialized
    Trigger Completer
    Completer Should Suggest    .print.via.format
    Select Completer Suggestion    .print.via.format
    Wait Until Keyword Succeeds    40x    0.5s    File Editor Line Should Equal    1    tools::.print.via.format
    # tripple colon
    Place Cursor In File Editor At    4    11
    Trigger Completer
    Completer Should Suggest    .packageName
    Select Completer Suggestion    .packageName
    Wait Until Keyword Succeeds    40x    0.5s    File Editor Line Should Equal    3    datasets:::.packageName
    [Teardown]    Clean Up After Working With File    completion.R

Completes Large Namespaces
    [Setup]    Prepare File for Editing    R    completion    completion.R
    Place Cursor In File Editor At    6    7
    Wait Until Fully Initialized
    Wait Until Keyword Succeeds    3x    2s    Trigger Completer    timeout=90s
    Completer Should Suggest    abs    timeout=30s
    [Teardown]    Clean Up After Working With File    completion.R

Shows Documentation With CompletionItem Resolve
    [Setup]    Prepare File for Editing    R    completion    completion.R
    Place Cursor In File Editor At    8    7
    Wait Until Fully Initialized
    Trigger Completer
    Completer Should Suggest    print.data.frame
    Completer Should Include Documentation    Print a data frame.
    # should remain visible after typing:
    Press Keys    None    efa
    Completer Should Suggest    print.default
    Completer Should Include Documentation    the default method of the
    [Teardown]    Clean Up After Working With File    completion.R

Shows Only Relevant Suggestions In Known Magics
    # https://github.com/krassowski/jupyterlab-lsp/issues/559
    # h<tab>
    Enter Cell Editor    20    line=2
    Trigger Completer
    Completer Should Suggest    help
    Completer Should Not Suggest    from
    Completer Should Suggest    hash

Completes In R Magics
    # Proper completion in R magics needs to be tested as:
    # - R magic extractor uses a tailor-made replacer function, not tested elsewhere
    # - R lanugage server is very sensitive to off-by-one errors (see https://github.com/REditorSupport/languageserver/issues/395)
    # '%%R\n librar<tab>'
    Enter Cell Editor    22    line=2
    Trigger Completer
    Completer Should Suggest    library
    # '%R lib<tab>'
    Enter Cell Editor    24    line=1
    Trigger Completer
    Completer Should Suggest    library

*** Keywords ***
Setup Completion Test
    Setup Notebook    Python    Completion.ipynb

Get Cell Editor Content
    [Arguments]    ${cell_nr}
    ${content} =    Execute JavaScript    return document.querySelector('.jp-Cell:nth-child(${cell_nr}) .CodeMirror').CodeMirror.getValue()
    [Return]    ${content}

Get File Editor Content
    ${content} =    Execute JavaScript    return document.querySelector('.jp-FileEditorCodeWrapper .CodeMirror').CodeMirror.getValue()
    [Return]    ${content}

Cell Editor Should Equal
    [Arguments]    ${cell}    ${value}
    ${content} =    Get Cell Editor Content    ${cell}
    Should Be Equal    ${content}    ${value}

File Editor Line Should Equal
    [Arguments]    ${line}    ${value}
    ${content} =    Get File Editor Content
    ${line} =    Get Line    ${content}    ${line}
    Should Be Equal    ${line}    ${value}

Select Completer Suggestion
    [Arguments]    ${text}
    ${suggestion} =    Set Variable    css:.jp-Completer-item[data-value="${text}"]
    Wait Until Element Is Visible    ${suggestion}    timeout=10s
    Mouse Over    ${suggestion}
    Click Element    ${suggestion} code

Completer Should Suggest
    [Arguments]    ${text}    ${timeout}=10s
    Wait Until Page Contains Element    ${COMPLETER_BOX} .jp-Completer-item[data-value="${text}"]    timeout=${timeout}
    Capture Page Screenshot    ${text.replace(' ', '_')}.png

Get Completion Item Vertical Position
    [Arguments]    ${text}
    ${position} =    Get Vertical Position    ${COMPLETER_BOX} .jp-Completer-item[data-value="${text}"]
    [Return]    ${position}

Completer Should Include Icon
    [Arguments]    ${icon}
    Wait Until Page Contains Element    ${COMPLETER_BOX} svg[data-icon="${icon}"]    timeout=10s

Completer Should Not Suggest
    [Arguments]    ${text}
    Wait Until Page Does Not Contain Element    ${COMPLETER_BOX} .jp-Completer-item[data-value="${text}"]

Trigger Completer
    [Arguments]    ${timeout}=35s
    Press Keys    None    TAB
    Wait Until Page Contains Element    ${COMPLETER_BOX}    timeout=${timeout}

Completer Should Include Documentation
    [Arguments]    ${text}
    Wait Until Page Contains Element    ${DOCUMENTATION_PANEL}    timeout=10s
    Wait Until Keyword Succeeds    10 x    1 s    Element Should Contain    ${DOCUMENTATION_PANEL}    ${text}
    Element Should Contain    ${DOCUMENTATION_PANEL}    ${text}

Count Completer Hints
    ${count} =    Get Element Count    css:.jp-Completer-item
    [Return]    ${count}

Should Complete While Kernel Is Busy
    # Run the cell with sleep(20)
    Enter Cell Editor    17
    # for some reason the lab command selects another cell along the way...
    # Lab Command    Run Selected Cells And Don't Advance
    Press Keys    None    CTRL+ENTER
    # Confirm that the kernel is busy
    Wait Until Page Contains Element    ${KERNEL_BUSY_INDICATOR}    timeout=5s
    # Enter a cell with "t"
    Enter Cell Editor    18
    # Check if completion worked
    Enter Cell Editor    1    line=2
    Trigger Completer    timeout=10s
    Completer Should Suggest    test
    # Confirm that the kernel indicator was busy all along
    Page Should Contain Element    ${KERNEL_BUSY_INDICATOR}
