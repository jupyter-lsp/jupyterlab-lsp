*** Settings ***
Resource          Variables.robot
Library           SeleniumLibrary
Library           OperatingSystem
Library           Process
Library           String
Library           ./ports.py

*** Keywords ***
Setup Server and Browser
    ${port} =    Get Unused Port
    Set Global Variable    ${PORT}    ${port}
    Set Global Variable    ${URL}    http://localhost:${PORT}${BASE}
    ${accel} =    Evaluate    "COMMAND" if "${OS}" == "Darwin" else "CTRL"
    Set Global Variable    ${ACCEL}    ${accel}
    ${token} =    Generate Random String
    Set Global Variable    ${TOKEN}    ${token}
    ${home} =    Set Variable    ${OUTPUT DIR}${/}home
    ${root} =    Normalize Path    ${OUTPUT DIR}${/}..${/}..${/}..
    Create Directory    ${home}
    Create Notebok Server Config    ${home}
    Initialize User Settings
    ${cmd} =    Create Lab Launch Command    ${root}
    Set Screenshot Directory    ${OUTPUT DIR}${/}screenshots
    Set Global Variable    ${LAB LOG}    ${OUTPUT DIR}${/}lab.log
    Set Global Variable    ${PREVIOUS LAB LOG LENGTH}    0
    ${server} =    Start Process    ${cmd}    shell=yes    env:HOME=${home}    cwd=${home}    stdout=${LAB LOG}
    ...    stderr=STDOUT
    Set Global Variable    ${SERVER}    ${server}
    Open JupyterLab
    ${script} =    Get Element Attribute    id:jupyter-config-data    innerHTML
    ${config} =    Evaluate    __import__("json").loads("""${script}""")
    Set Global Variable    ${PAGE CONFIG}    ${config}
    Set Global Variable    ${LAB VERSION}    ${config["appVersion"]}

Create Lab Launch Command
    [Arguments]    ${root}
    [Documentation]    Create a JupyterLab CLI shell string, escaping for traitlets
    ${WORKSPACES DIR} =    Set Variable    ${OUTPUT DIR}${/}workspaces
    ${app args} =    Set Variable    --no-browser --debug --NotebookApp.base_url\='${BASE}' --port\=${PORT} --NotebookApp.token\='${TOKEN}'
    ${path args} =    Set Variable    --LabApp.user_settings_dir='${SETTINGS DIR.replace('\\', '\\\\')}' --LabApp.workspaces_dir\='${WORKSPACES DIR.replace('\\', '\\\\')}'
    ${ext args} =    Set Variable    --LanguageServerManager.extra_node_roots\="['${root.replace('\\', '\\\\')}']"
    ${cmd} =    Set Variable    jupyter-lab ${app args} ${path args} ${ext args}
    [Return]    ${cmd}

Create Notebok Server Config
    [Arguments]    ${home}
    [Documentation]    Copies in notebook server config file to disables npm/build checks
    Copy File    ${FIXTURES}${/}${NBSERVER CONF}    ${home}${/}${NBSERVER CONF}

Setup Suite For Screenshots
    [Arguments]    ${folder}
    Set Screenshot Directory    ${OUTPUT DIR}${/}screenshots${/}${folder}
    Set Tags    lab:${LAB VERSION}

Initialize User Settings
    Set Suite Variable    ${SETTINGS DIR}    ${OUTPUT DIR}${/}user-settings    children=${True}
    Create File    ${SETTINGS DIR}${/}@jupyterlab${/}codemirror-extension${/}commands.jupyterlab-settings    {"styleActiveLine": true}

Reset Plugin Settings
    Create File    ${SETTINGS DIR}${/}${LSP PLUGIN SETTINGS FILE}    {}

Tear Down Everything
    Close All Browsers
    Evaluate    __import__("urllib.request").request.urlopen("${URL}api/shutdown?token=${TOKEN}", data=[])
    Wait For Process    ${SERVER}    timeout=30s
    Terminate All Processes
    Terminate All Processes    kill=${True}

Lab Log Should Not Contain Known Error Messages
    ${log} =    Get File    ${LAB LOG}
    ${test log} =    Set Variable    ${log[${PREVIOUS LAB LOG LENGTH}:]}
    ${length} =    Get Length    ${log}
    Set Global Variable    ${PREVIOUS LAB LOG LENGTH}    ${length}
    Run Keyword If    ("${OS}", "${PY}") !\= ("Windows", "36")
    ...    Should Not Contain Any    ${test log}    @{KNOWN BAD ERRORS}

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
    ...    service_log_path=${OUTPUT DIR}${/}geckodriver.log
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
    Click Element    css:button[title="Refresh File List"]
    ${selector} =    Set Variable    xpath://span[@class='jp-DirListing-itemText']\[text() = '${file}']
    Wait Until Page Contains Element    ${selector}
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

Open ${file} in ${editor}
    Open Context Menu for File    ${file}
    Mouse Over    ${MENU OPEN WITH}
    Wait Until Page Contains Element    ${editor}
    Mouse Over    ${editor}
    Click Element    ${editor}

Clean Up After Working With File
    [Arguments]    ${file}
    Remove File    ${OUTPUT DIR}${/}home${/}${file}
    Reset Application State
    Lab Log Should Not Contain Known Error Messages

Setup Notebook
    [Arguments]    ${Language}    ${file}    ${isolated}=${True}
    Set Tags    language:${Language.lower()}
    Run Keyword If    ${isolated}    Set Screenshot Directory    ${OUTPUT DIR}${/}screenshots${/}notebook${/}${TEST NAME.replace(' ', '_')}
    Copy File    examples${/}${file}    ${OUTPUT DIR}${/}home${/}${file}
    Run Keyword If    ${isolated}    Try to Close All Tabs
    Open ${file} in ${MENU NOTEBOOK}
    Capture Page Screenshot    00-notebook-opened.png
    Wait Until Fully Initialized
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
    Wait Until Keyword Succeeds    10 x    0.1 s    Click Element    ${sel}
    Wait Until Keyword Succeeds    10 x    0.1 s    Open Context Menu    ${sel}

Prepare File for Editing
    [Arguments]    ${Language}    ${Screenshots}    ${file}
    Set Tags    language:${Language.lower()}
    Set Screenshot Directory    ${OUTPUT DIR}${/}screenshots${/}${Screenshots}${/}${Language.lower()}
    Try to Close All Tabs
    Open File    ${file}

Open File
    [Arguments]    ${file}
    Copy File    examples${/}${file}    ${OUTPUT DIR}${/}home${/}${file}
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
