*** Settings ***
Resource          Variables.robot
Library           Collections
Library           OperatingSystem
Library           Process
Library           String
Library           SeleniumLibrary
Library           ./logcheck.py
Library           ./ports.py
Library           ./config.py

*** Keywords ***
Setup Server and Browser
    [Arguments]    ${server_extension_enabled}=${True}
    Initialize Global Variables
    Create Notebok Server Config    ${server_extension_enabled}
    Initialize User Settings
    ${disable_global_config} =    Set Variable If    ${server_extension_enabled} != ${True}    '1'    ${EMPTY}
    ${server} =    Start Process    jupyter-lab
    ...    cwd=${NOTEBOOK DIR}
    ...    stdout=${LAB LOG}
    ...    stderr=STDOUT
    ...    env:HOME=${HOME}
    ...    env:JUPYTER_NO_CONFIG=${disable_global_config}
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
    [Arguments]    ${server_extension_enabled}=${True}
    [Documentation]    Copies in notebook server config file and updates accordingly
    ${conf} =    Set Variable    ${NOTEBOOK DIR}${/}${NBSERVER CONF}
    ${extra_node_roots} =    Create List    ${ROOT}
    ${port} =    Get Unused Port
    Set Global Variable    ${PORT}    ${port}
    Set Global Variable    ${URL}    http://localhost:${PORT}${BASE URL}
    Copy File    ${FIXTURES}${/}${NBSERVER CONF}    ${conf}
    Update Jupyter Config    ${conf}    LabApp
    ...    base_url=${BASE URL}
    ...    port=${PORT}
    ...    token=${TOKEN}
    ...    user_settings_dir=${SETTINGS DIR}
    ...    workspaces_dir=${WORKSPACES DIR}
    # should be automatically enabled, so do not enable manually:
    Run Keyword Unless
    ...    ${server_extension_enabled}
    ...    Set Server Extension State    ${conf}    enabled=${server_extension_enabled}
    Update Jupyter Config    ${conf}    LanguageServerManager
    ...    extra_node_roots=@{extra_node_roots}

Set Server Extension State
    [Arguments]    ${conf}    ${enabled}=${True}
    ${extension_state} =    Create Dictionary    enabled=${enabled}
    ${extensions} =    Create Dictionary    jupyter_lsp=${extension_state}
    Update Jupyter Config    ${conf}    LabApp
    ...    jpserver_extensions=${extensions}

Read Page Config
    ${script} =    Get Element Attribute    id:jupyter-config-data    innerHTML
    ${config} =    Evaluate    __import__("json").loads(r"""${script}""")
    Set Global Variable    ${PAGE CONFIG}    ${config}
    Set Global Variable    ${LAB VERSION}    ${config["appVersion"]}

Setup Suite For Screenshots
    [Arguments]    ${folder}
    Set Screenshot Directory    ${SCREENSHOTS DIR}${/}${folder}
    Set Tags    lab:${LAB VERSION}

Initialize User Settings
    Create File
    ...    ${SETTINGS DIR}${/}@jupyterlab${/}codemirror-extension${/}commands.jupyterlab-settings
    ...    {"styleActiveLine": true}
    Create File
    ...    ${SETTINGS DIR}${/}@jupyterlab${/}apputils-extension${/}palette.jupyterlab-settings
    ...    {"modal": false}

Reset Plugin Settings
    [Arguments]    ${package}=jupyterlab-lsp    ${plugin}=plugin
    ${LSP PLUGIN SETTINGS FILE} =    Set Variable    @krassowski${/}${package}${/}${plugin}.jupyterlab-settings
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
    Wait Until Page Contains Element    ${SPLASH}    timeout=30s
    Wait Until Page Does Not Contain Element    ${SPLASH}    timeout=10s
    Execute Javascript    window.onbeforeunload \= function (){}

Open JupyterLab
    Set Environment Variable    MOZ_HEADLESS    ${HEADLESS}
    ${firefox} =    Get Firefox Binary
    ${geckodriver} =    Which    geckodriver
    ${service args} =    Create List    --log    debug
    Create WebDriver    Firefox
    ...    executable_path=${geckodriver}
    ...    firefox_binary=${firefox}
    ...    service_log_path=${GECKODRIVER LOG}
    ...    service_args=${service args}
    Wait Until Keyword Succeeds    3x    5s    Wait For Splash

Get Firefox Binary
    [Documentation]    Get Firefox path from the environment... or hope for the best
    ${from which} =    Which    firefox
    ${firefox} =    Set Variable If    "%{FIREFOX_BINARY}"    %{FIREFOX_BINARY}    ${from which}
    [Return]    ${firefox}

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
    Lab Command    Reset Application State
    Wait Until Keyword Succeeds    3x    5s    Wait For Splash

Accept Default Dialog Option
    [Documentation]    Accept a dialog, if it exists
    ${el} =    Get WebElements    ${CSS DIALOG OK}
    Run Keyword If    ${el.__len__()}    Click Element    ${CSS DIALOG OK}

Ensure All Kernels Are Shut Down
    Enter Command Name    Shut Down All Kernels
    ${els} =    Get WebElements    ${CMD PALETTE ITEM ACTIVE}
    Run Keyword If    ${els.__len__()}    Click Element    ${CMD PALETTE ITEM ACTIVE}
    ${accept} =    Set Variable    css:.jp-mod-accept.jp-mod-warn
    Run Keyword If    ${els.__len__()}    Wait Until Page Contains Element    ${accept}
    Run Keyword If    ${els.__len__()}    Click Element    ${accept}

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
    [Return]    ${path}

Click JupyterLab Menu
    [Arguments]    ${label}
    [Documentation]    Click a top-level JupyterLab menu bar item with by ``label``,
    ...    e.g. File, Help, etc.
    ${xpath} =    Set Variable    ${JLAB XP TOP}${JLAB XP MENU LABEL}\[text() = '${label}']
    Wait Until Page Contains Element    ${xpath}
    Mouse Over    ${xpath}
    Click Element    ${xpath}

Click JupyterLab Menu Item
    [Arguments]    ${label}
    [Documentation]    Click a currently-visible JupyterLab menu item by ``label``.
    ${item} =    Set Variable    ${JLAB XP MENU ITEM LABEL}\[text() = '${label}']
    Wait Until Page Contains Element    ${item}
    Mouse Over    ${item}
    Click Element    ${item}

Open With JupyterLab Menu
    [Arguments]    ${menu}    @{submenus}
    [Documentation]    Click into a ``menu``, then a series of ``submenus``
    Click JupyterLab Menu    ${menu}
    FOR    ${submenu}    IN    @{submenus}
        Click JupyterLab Menu Item    ${submenu}
    END

Ensure File Browser is Open
    ${sel} =    Set Variable    css:.lm-TabBar-tab[data-id="filebrowser"]:not(.lm-mod-current)
    ${els} =    Get WebElements    ${sel}
    Run Keyword If    ${els.__len__()}    Click Element    ${sel}

Ensure Sidebar Is Closed
    [Arguments]    ${side}=left
    ${els} =    Get WebElements    css:#jp-${side}-stack
    Run Keyword If    ${els.__len__()}    Click Element    css:.jp-mod-${side} .lm-TabBar-tab.lm-mod-current

Open Context Menu for File
    [Arguments]    ${file}
    Ensure File Browser is Open
    Click Element    ${JLAB CSS REFRESH FILES}
    ${selector} =    Set Variable    xpath://span[@class='jp-DirListing-itemText']/span\[text() = '${file}']
    Wait Until Page Contains Element    ${selector}    timeout=10s
    Open Context Menu    ${selector}

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
    Click Element    ${JLAB CSS REFRESH FILES}
    FOR    ${path}    IN    @{paths}
        ${sel} =    Set Variable    css:li.jp-DirListing-item\[title^='Name: ${path}']
        Wait Until Page Contains Element    ${sel}
        Double Click Element    ${sel}
    END

Open ${file} in ${editor}
    ${paths} =    Set Variable    ${file.split("/")}
    Run Keyword If    ${paths.__len__() > 1}    Open Folder    @{paths[:-1]}
    ${file} =    Set Variable    ${paths[-1]}
    Open Context Menu for File    ${file}
    Mouse Over    ${MENU OPEN WITH}
    Wait Until Page Contains Element    ${editor}
    Mouse Over    ${editor}
    Click Element    ${editor}

Clean Up After Working With File
    [Arguments]    ${file}
    Remove File    ${NOTEBOOK DIR}${/}${file}
    Reset Application State
    Lab Log Should Not Contain Known Error Messages

Setup Notebook
    [Arguments]    ${Language}    ${file}    ${isolated}=${True}    ${wait}=${True}
    Set Tags    language:${Language.lower()}
    Run Keyword If    ${isolated}    Set Screenshot Directory    ${SCREENSHOTS DIR}${/}notebook${/}${TEST NAME.replace(' ', '_')}
    Copy File    examples${/}${file}    ${NOTEBOOK DIR}${/}${file}
    Run Keyword If    ${isolated}    Try to Close All Tabs
    Open ${file} in ${MENU NOTEBOOK}
    Capture Page Screenshot    00-notebook-opened.png
    Run Keyword If
    ...    ${wait}
    ...    Wait Until Fully Initialized
    Capture Page Screenshot    01-notebook-initialized.png

Open Diagnostics Panel
    Lab Command    Show Diagnostics Panel
    Wait Until Page Contains Element    ${DIAGNOSTICS PANEL}    timeout=20s

Count Diagnostics In Panel
    ${count} =    Get Element Count    css:.lsp-diagnostics-listing tbody tr
    [Return]    ${count}

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
    Execute JavaScript    return document.querySelector('.jp-Cell:nth-child(${cell_nr}) .CodeMirror').CodeMirror.setCursor({line: ${line} - 1, ch: ${character}})

Enter File Editor
    Click Element    css:.jp-FileEditor .CodeMirror
    Wait Until Page Contains Element    css:.jp-FileEditor .CodeMirror-focused

Place Cursor In File Editor At
    [Arguments]    ${line}    ${character}
    Enter File Editor
    Execute JavaScript    return document.querySelector('.jp-FileEditor .CodeMirror').CodeMirror.setCursor({line: ${line} - 1, ch: ${character}})

Wait Until Fully Initialized
    Wait Until Element Contains    ${STATUSBAR}    Fully initialized    timeout=60s

Open Context Menu Over
    [Arguments]    ${sel}
    Wait Until Keyword Succeeds    10 x    0.1 s    Mouse Over    ${sel}
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
    Lab Command    Advanced Settings Editor
    ${sel} =    Set Variable    css:[data-id="${plugin id}"]
    Wait Until Page Contains Element    ${sel}
    Click Element    ${sel}
    Wait Until Page Contains    System Defaults

Set Editor Content
    [Arguments]    ${text}    ${css}=${EMPTY}
    Execute JavaScript    return document.querySelector('${css} .CodeMirror').CodeMirror.setValue(`${text}`)

Get Editor Content
    [Arguments]    ${css}=${EMPTY}
    ${content} =    Execute JavaScript    return document.querySelector('${css} .CodeMirror').CodeMirror.getValue()
    [Return]    ${content}

Configure JupyterLab Plugin
    [Arguments]    ${settings json}    ${plugin id}=${LSP PLUGIN ID}
    Open in Advanced Settings    ${plugin id}
    Set Editor Content    ${settings json}    ${CSS USER SETTINGS}
    Wait Until Page Contains    No errors found
    Click Element    css:button[title\='Save User Settings']
    Click Element    ${JLAB XP CLOSE SETTINGS}

Clean Up After Working with File and Settings
    [Arguments]    ${file}
    Clean Up After Working With File    ${file}
    Reset Plugin Settings

Jump To Definition
    [Arguments]    ${symbol}
    ${sel} =    Set Variable If    "${symbol}".startswith(("xpath", "css"))    ${symbol}    xpath:(//span[@role="presentation"][contains(., "${symbol}")])[last()]
    Open Context Menu Over    ${sel}
    ${cursor} =    Measure Cursor Position
    Capture Page Screenshot    02-jump-to-definition-0.png
    Mouse Over    ${MENU JUMP}
    Capture Page Screenshot    02-jump-to-definition-1.png
    Click Element    ${MENU JUMP}
    [Return]    ${cursor}

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
    [Return]    ${position}

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
