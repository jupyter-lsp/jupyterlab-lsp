*** Settings ***
Library     OperatingSystem
Library     Process
Library     String
Library     Collections
Library     SeleniumLibrary
Resource    Variables.resource
Library     ./logcheck.py
Library     ./ports.py
Library     ./config.py
Library     ./paths.py


*** Keywords ***
Setup Server and Browser
    Initialize Global Variables
    Create Notebok Server Config
    Initialize User Settings
    ${server} =    Start Process    jupyter-lab
    ...    cwd=${NOTEBOOK DIR}
    ...    stdout=${LAB LOG}
    ...    stderr=STDOUT
    ...    env:HOME=${HOME}
    ...    env:JUPYTER_NO_CONFIG=${EMPTY}
    Set Global Variable    ${SERVER}    ${server}
    Open JupyterLab
    Read Page Config

Initialize Global Variables
    ${root} =    Normalize Path    ${OUTPUT DIR}${/}..${/}..${/}..
    Set Global Variable    ${ROOT}    ${root}
    ${accel} =    Evaluate    "COMMAND" if "${OS}" == "Darwin" else "CTRL"
    Set Global Variable    ${ACCEL}    ${accel}
    ${token} =    Generate Random String
    Set Global Variable    ${TOKEN}    ${token}
    Set Global Variable    ${PREVIOUS LAB LOG LENGTH}    0
    Set Screenshot Directory    ${SCREENSHOTS DIR}

Create Notebok Server Config
    [Documentation]    Copies in notebook server config file and updates accordingly
    ${conf} =    Set Variable    ${NOTEBOOK DIR}${/}${JPSERVER CONF JSON}
    Set Environment Variable
    ...    name=JUPYTER_CONFIG_DIR
    ...    value=${NOTEBOOK DIR}
    ${jupyterlab_dir} =    Get JupyterLab Path
    ${extra_node_roots} =    Create List    ${ROOT}
    ${port} =    Get Unused Port
    Set Global Variable    ${PORT}    ${port}
    Set Global Variable    ${URL}    http://localhost:${PORT}${BASE URL}
    Copy File    ${FIXTURES}${/}${JPSERVER CONF JSON}    ${conf}
    Copy File    ${FIXTURES}${/}${JPSERVER CONF PY}    ${NOTEBOOK DIR}${/}${JPSERVER CONF PY}
    Copy File    ${FIXTURES}${/}overrides.json    ${jupyterlab_dir}${/}settings${/}overrides.json
    Update Jupyter Config    ${conf}    ServerApp
    ...    base_url=${BASE URL}
    ...    port=${PORT}
    ...    token=${TOKEN}
    Update Jupyter Config    ${conf}    LabApp
    ...    user_settings_dir=${SETTINGS DIR}
    ...    workspaces_dir=${WORKSPACES DIR}
    Update Jupyter Config    ${conf}    LanguageServerManager
    ...    extra_node_roots=@{extra_node_roots}

Set Server Extension State
    [Arguments]    ${enabled}=${True}
    Set Environment Variable
    ...    name=JUPYTER_CONFIG_DIR
    ...    value=${NOTEBOOK DIR}
    IF    ${enabled}
        Run Process    jupyter server extension enable jupyter_lsp
        ...    shell=yes
    ELSE
        Run Process    jupyter server extension disable jupyter_lsp
        ...    shell=yes
    END

Read Page Config
    ${script} =    Get Element Attribute    id:jupyter-config-data    innerHTML
    ${config} =    Evaluate    __import__("json").loads(r"""${script}""")
    Set Global Variable    ${PAGE CONFIG}    ${config}
    Set Global Variable    ${LAB VERSION}    ${config["appVersion"]}

Setup Suite For Screenshots
    [Arguments]    ${folder}
    Set Screenshot Directory    ${SCREENSHOTS DIR}${/}${folder}
    Set Tags    lab:${LAB VERSION}
    Reset Application State

Initialize User Settings
    Create File
    ...    ${SETTINGS DIR}${/}@jupyterlab${/}codemirror-extension${/}commands.jupyterlab-settings
    ...    {"styleActiveLine": true}
    Create File
    ...    ${SETTINGS DIR}${/}@jupyterlab${/}apputils-extension${/}palette.jupyterlab-settings
    ...    {"modal": false}
    Create File
    ...    ${SETTINGS DIR}${/}@jupyterlab${/}apputils-extension${/}notification.jupyterlab-settings
    ...    {"fetchNews": "false"}

Reset Plugin Settings
    [Arguments]    ${package}=jupyterlab-lsp    ${plugin}=plugin
    ${LSP PLUGIN SETTINGS FILE} =    Set Variable    @jupyter-lsp${/}${package}${/}${plugin}.jupyterlab-settings
    Create File    ${SETTINGS DIR}${/}${LSP PLUGIN SETTINGS FILE}    {}

Tear Down Everything
    Close All Browsers
    Evaluate    __import__("urllib.request").request.urlopen("${URL}api/shutdown?token=${TOKEN}", data=[])
    Wait For Process    ${SERVER}    timeout=30s
    Terminate All Processes
    Terminate All Processes    kill=${True}

Lab Log Should Not Contain Known Error Messages
    Touch    ${LAB LOG}
    ${length} =    Get File Size    ${LAB LOG}
    File Should Not Contain Phrases    ${LAB LOG}    ${PREVIOUS LAB LOG LENGTH}    @{KNOWN BAD ERRORS}
    [Teardown]    Set Global Variable    ${PREVIOUS LAB LOG LENGTH}    ${length}

Wait For Splash
    Go To    ${URL}lab?reset&token=${TOKEN}
    Set Window Size    1024    768
    Wait Until Page Contains Element    ${SPLASH}    timeout=45s
    Wait Until Page Does Not Contain Element    ${SPLASH}    timeout=10s
    Execute Javascript    window.onbeforeunload \= function (){}

Open JupyterLab
    Set Environment Variable    MOZ_HEADLESS    ${HEADLESS}
    ${geckodriver} =    Which    geckodriver
    Should Not Be Equal As Strings    ${geckodriver}    None
    ...    geckodriver not found, do you need to install firefox-geckodriver?
    ${service args} =    Create List    --log    debug
    Create WebDriver    Firefox
    ...    executable_path=${geckodriver}
    ...    service_log_path=${GECKODRIVER LOG}
    ...    service_args=${service args}
    Wait Until Keyword Succeeds    3x    5s    Wait For Splash

Close JupyterLab
    Close All Browsers

Close All Tabs
    Accept Default Dialog Option
    Lab Command    Close All Tabs
    Accept Default Dialog Option

Try to Close All Tabs
    Wait Until Keyword Succeeds    5x    50ms    Close All Tabs

Reset Application State
    Try to Close All Tabs
    Accept Default Dialog Option
    Ensure All Kernels Are Shut Down
    Accept Default Dialog Option

Accept Default Dialog Option
    [Documentation]    Accept a dialog, if it exists
    ${el} =    Get WebElements    ${CSS DIALOG OK}
    IF    ${el.__len__()}    Click Element    ${CSS DIALOG OK}

Ensure All Kernels Are Shut Down
    Enter Command Name    Shut Down All Kernels
    ${els} =    Get WebElements    ${CMD PALETTE ITEM ACTIVE}
    IF    ${els.__len__()}
        Click Element    ${CMD PALETTE ITEM ACTIVE}
        Accept Default Dialog Option
    END

Open Command Palette
    Press Keys    id:main    ${ACCEL}+SHIFT+c
    Wait Until Page Contains Element    ${CMD PALETTE INPUT}
    Click Element    ${CMD PALETTE INPUT}

Enter Command Name
    [Arguments]    ${cmd}
    Open Command Palette
    Input Text    ${CMD PALETTE INPUT}    ${cmd}

Lab Command
    [Arguments]    ${cmd}
    Enter Command Name    ${cmd}
    Wait Until Page Contains Element    ${CMD PALETTE ITEM ACTIVE}
    Click Element    ${CMD PALETTE ITEM ACTIVE}

Which
    [Arguments]    ${cmd}
    ${path} =    Evaluate    __import__("shutil").which("${cmd}")
    RETURN    ${path}

Click JupyterLab Menu
    [Documentation]    Click a top-level JupyterLab menu bar item with by ``label``,
    ...    e.g. File, Help, etc.
    [Arguments]    ${label}
    ${xpath} =    Set Variable    xpath:${JLAB XP TOP}${JLAB XP MENU LABEL}\[text() = '${label}']
    Wait Until Page Contains Element    ${xpath}
    Mouse Over    ${xpath}
    Click Element    ${xpath}

Click JupyterLab Menu Item
    [Documentation]    Click a currently-visible JupyterLab menu item by ``label``.
    [Arguments]    ${label}
    ${item} =    Set Variable    ${JLAB XP MENU ITEM LABEL}\[text() = '${label}']
    Wait Until Page Contains Element    ${item}
    Mouse Over    ${item}
    Click Element    ${item}

Open With JupyterLab Menu
    [Documentation]    Click into a ``menu``, then a series of ``submenus``
    [Arguments]    ${menu}    @{submenus}
    Click JupyterLab Menu    ${menu}
    FOR    ${submenu}    IN    @{submenus}
        Click JupyterLab Menu Item    ${submenu}
    END

Ensure File Browser is Open
    ${sel} =    Set Variable    css:.lm-TabBar-tab[data-id="filebrowser"]:not(.lm-mod-current)
    ${els} =    Get WebElements    ${sel}
    IF    ${els.__len__()}    Click Element    ${sel}

Ensure Sidebar Is Closed
    [Arguments]    ${side}=left
    ${els} =    Get WebElements    css:#jp-${side}-stack
    IF    ${els.__len__()}
        Click Element    css:.jp-mod-${side} .lm-TabBar-tab.lm-mod-current
    END

Refresh File List
    Ensure File Browser is Open
    IF    [int(part) for part in "${LAB VERSION}".split(".")] >= [3, 4, 0]
        Click Element    ${JLAB CSS REFRESH FILES}
    ELSE
        Click Element    ${JLAB CSS REFRESH F_OLD}
    END

Open Context Menu for File
    [Arguments]    ${file}
    Refresh File List
    ${selector} =    Set Variable    xpath://span[@class='jp-DirListing-itemText']/span\[text() = '${file}']
    Wait Until Page Contains Element    ${selector}    timeout=10s
    Wait Until Keyword Succeeds    10 x    0.1 s    Open Context Menu    ${selector}

Rename Jupyter File
    [Arguments]    ${old}    ${new}
    Open Context Menu for File    ${old}
    Mouse Over    ${MENU RENAME}
    Click Element    ${MENU RENAME}
    Press Keys    None    CTRL+a
    Press Keys    None    ${new}
    Press Keys    None    RETURN

Input Into Dialog
    [Arguments]    ${text}
    Wait For Dialog
    Click Element    ${DIALOG INPUT}
    Input Text    ${DIALOG INPUT}    ${text}
    Click Element    ${DIALOG ACCEPT}

Open Folder
    [Arguments]    @{paths}
    Refresh File List
    FOR    ${path}    IN    @{paths}
        ${sel} =    Set Variable    css:li.jp-DirListing-item\[title^='Name: ${path}']
        Wait Until Page Contains Element    ${sel}
        Wait Until Element Is Visible    ${sel}    timeout=5s
        Double Click Element    ${sel}
    END

Navigate to Root Folder
    Ensure File Browser is Open
    Click Element    ${ROOT FOLDER}

Open ${file} in ${editor}
    ${paths} =    Set Variable    ${file.split("/")}
    IF    ${paths.__len__() > 1}    Open Folder    @{paths[:-1]}
    ${file} =    Set Variable    ${paths[-1]}
    Open Context Menu for File    ${file}
    Mouse Over    ${MENU OPEN WITH}
    Wait Until Page Contains Element    ${editor}
    Mouse Over    ${editor}
    Click Element    ${editor}

Clean Up After Working With Files
    [Arguments]    @{files}
    FOR    ${file}    IN    @{files}
        Remove File    ${NOTEBOOK DIR}${/}${file}
    END
    Reset Application State
    Lab Log Should Not Contain Known Error Messages

Clean Up After Working With File
    [Arguments]    ${file}
    Clean Up After Working With Files    ${file}

Setup Notebook
    [Arguments]    ${Language}    ${file}    ${isolated}=${True}    ${wait}=${True}
    Set Tags    language:${Language.lower()}
    IF    ${isolated}
        Set Screenshot Directory    ${SCREENSHOTS DIR}${/}notebook${/}${TEST NAME.replace(' ', '_')}
    END
    Copy File    examples${/}${file}    ${NOTEBOOK DIR}${/}${file}
    IF    ${isolated}    Try to Close All Tabs
    Open ${file} in ${MENU NOTEBOOK}
    Capture Page Screenshot    00-notebook-opened.png
    IF    ${wait}    Wait Until Fully Initialized
    Capture Page Screenshot    01-notebook-initialized.png

Open Diagnostics Panel
    Lab Command    Show Diagnostics Panel
    Wait Until Page Contains Element    ${DIAGNOSTICS PANEL}    timeout=20s

Count Diagnostics In Panel
    ${count} =    Get Element Count    css:.lsp-diagnostics-listing tbody tr
    RETURN    ${count}

Close Diagnostics Panel
    Mouse Over    ${DIAGNOSTIC PANEL CLOSE}
    Click Element    ${DIAGNOSTIC PANEL CLOSE}

Wait For Dialog
    Wait Until Page Contains Element    ${DIALOG WINDOW}    timeout=180s

Gently Reset Workspace
    Try to Close All Tabs

Enter Cell Editor
    [Arguments]    ${cell_nr}    ${line}=1
    Click Element    css:.jp-Cell:nth-child(${cell_nr}) .CodeMirror-line:nth-child(${line})
    Wait Until Page Contains Element    css:.jp-Cell:nth-child(${cell_nr}) .CodeMirror-focused

Open Context Menu Over Cell Editor
    [Arguments]    ${cell_nr}    ${line}=1
    Enter Cell Editor    ${cell_nr}    line=${line}
    Open Context Menu Over    css:.jp-Cell:nth-child(${cell_nr}) .CodeMirror-line:nth-child(${line})

Place Cursor In Cell Editor At
    [Arguments]    ${cell_nr}    ${line}    ${character}
    Enter Cell Editor    ${cell_nr}    ${line}
    Execute JavaScript
    ...    return document.querySelector('.jp-Cell:nth-child(${cell_nr}) .CodeMirror').CodeMirror.setCursor({line: ${line} - 1, ch: ${character}})

Enter File Editor
    Click Element    css:.jp-FileEditor .CodeMirror
    Wait Until Page Contains Element    css:.jp-FileEditor .CodeMirror-focused

Place Cursor In File Editor At
    [Arguments]    ${line}    ${character}
    Enter File Editor
    Execute JavaScript
    ...    return document.querySelector('.jp-FileEditor .CodeMirror').CodeMirror.setCursor({line: ${line} - 1, ch: ${character}})

Wait Until Fully Initialized
    Wait Until Element Contains    ${STATUSBAR}    Fully initialized    timeout=60s

Wait For Ready State
    Wait For Condition    return document.readyState=="complete"

Open Context Menu Over
    [Arguments]    ${sel}
    Wait For Ready State
    Wait Until Keyword Succeeds    10 x    0.1 s    Mouse Over    ${sel}
    Wait For Ready State
    Wait Until Keyword Succeeds    10 x    0.1 s    Open Context Menu    ${sel}

Context Menu Should Contain
    [Arguments]    ${label}    ${timeout}=10s
    ${entry} =    Set Variable    xpath://div[contains(@class, 'lm-Menu-itemLabel')][contains(text(), '${label}')]
    Wait Until Page Contains Element    ${entry}    timeout=${timeout}

Context Menu Should Not Contain
    [Arguments]    ${label}    ${timeout}=10s
    ${entry} =    Set Variable    xpath://div[contains(@class, 'lm-Menu-itemLabel')][contains(text(), '${label}')]
    Wait Until Page Does Not Contain Element    ${entry}    timeout=${timeout}

Close Context Menu
    Press Keys    None    ESCAPE

Prepare File for Editing
    [Arguments]    ${Language}    ${Screenshots}    ${file}
    Set Tags    language:${Language.lower()}
    Set Screenshot Directory    ${SCREENSHOTS DIR}${/}${Screenshots}${/}${Language.lower()}
    Try to Close All Tabs
    Open File    ${file}

Open File
    [Arguments]    ${file}
    Copy File    examples${/}${file}    ${NOTEBOOK DIR}${/}${file}
    Open ${file} in ${MENU EDITOR}
    Capture Page Screenshot    00-opened.png

Open in Advanced Settings
    [Arguments]    ${plugin id}
    IF    '${LAB VERSION}'.startswith('3.')
        Lab Command    Advanced JSON Settings Editor
    ELSE
        Lab Command    Advanced Settings Editor
    END
    ${sel} =    Set Variable    css:[data-id="${plugin id}"]
    Wait Until Page Contains Element    ${sel}    timeout=10s
    Click Element    ${sel}
    Wait Until Page Contains    System Defaults

Set Editor Content
    [Arguments]    ${text}    ${css}=${EMPTY}
    Execute JavaScript    return document.querySelector('${css} .CodeMirror').CodeMirror.setValue(`${text}`)

Get Editor Content
    [Arguments]    ${css}=${EMPTY}
    ${content} =    Execute JavaScript    return document.querySelector('${css} .CodeMirror').CodeMirror.getValue()
    RETURN    ${content}

Configure JupyterLab Plugin
    [Arguments]    ${settings json}    ${plugin id}=${LSP PLUGIN ID}
    Open in Advanced Settings    ${plugin id}
    Set Editor Content    ${settings json}    ${CSS USER SETTINGS}
    Wait Until Page Contains    No errors found
    Click Element    css:button[title^\='Save User Settings']
    Wait Until Page Contains    No errors found
    Click Element    ${JLAB XP CLOSE SETTINGS}

Clean Up After Working with File and Settings
    [Arguments]    ${file}
    Clean Up After Working With File    ${file}
    Reset Plugin Settings

Jump To Definition
    [Arguments]    ${symbol}
    ${sel} =    Set Variable If    "${symbol}".startswith(("xpath", "css"))    ${symbol}
    ...    xpath:(//span[@role="presentation"][contains(., "${symbol}")])[last()]
    Open Context Menu Over    ${sel}
    ${cursor} =    Measure Cursor Position
    Capture Page Screenshot    02-jump-to-definition-0.png
    Wait Until Element Is Visible    ${MENU JUMP}    timeout=5s
    Mouse Over    ${MENU JUMP}
    Capture Page Screenshot    02-jump-to-definition-1.png
    Click Element    ${MENU JUMP}
    RETURN    ${cursor}

Editor Should Jump To Definition
    [Arguments]    ${symbol}
    Set Tags    feature:jump-to-definition
    ${cursor} =    Jump To Definition    ${symbol}
    Wait Until Keyword Succeeds    10 x    1 s    Cursor Should Jump    ${cursor}
    Capture Page Screenshot    02-jump-to-definition-2.png

Cursor Should Jump
    [Arguments]    ${original}
    ${current} =    Measure Cursor Position
    Should Not Be Equal    ${original}    ${current}

Measure Cursor Position
    Wait Until Page Contains Element    ${CM CURSORS}
    ${position} =    Wait Until Keyword Succeeds    20 x    0.05s    Get Vertical Position    ${CM CURSOR}
    RETURN    ${position}

Switch To Tab
    [Arguments]    ${file}
    Click Element    ${JLAB XP DOCK TAB}\[contains(., '${file}')]

Open New Notebook
    Lab Command    New Notebook
    Wait For Dialog
    # Kernel selection dialog shows up, accept Python as default kernel
    Accept Default Dialog Option

Restart Kernel
    Lab Command    Restart Kernel…
    Wait For Dialog
    Accept Default Dialog Option

Expand Menu Entry
    [Arguments]    ${label}
    ${entry} =    Set Variable    xpath://div[contains(@class, 'lm-Menu-itemLabel')][contains(text(), "${label}")]
    Wait Until Page Contains Element    ${entry}    timeout=10s
    ${menus before} =    Get Element Count    ${LAB MENU}
    Mouse Over    ${entry}
    ${expected menus} =    Evaluate    ${menus before} + 1
    Wait Until Keyword Succeeds    10 x    1s    Menus Count Equal    ${expected menus}

Menus Count Equal
    [Arguments]    ${count}
    ${menus count} =    Get Element Count    ${LAB MENU}
    Should Be Equal    ${menus count}    ${count}

Select Menu Entry
    [Arguments]    ${label}
    ${entry} =    Set Variable    xpath://div[contains(@class, 'lm-Menu-itemLabel')][contains(text(), '${label}')]
    Wait Until Page Contains Element    ${entry}    timeout=10s
    Mouse Over    ${entry}
    Click Element    ${entry}
    Wait Until Page Does Not Contain Element    ${entry}    timeout=10s
