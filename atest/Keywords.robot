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
    ${WORKSPACES DIR} =    Set Variable    ${OUTPUT DIR}${/}workspaces
    Initialize User Settings
    ${app args} =    Set Variable    --no-browser --debug --NotebookApp.base_url\='${BASE}' --port\=${PORT} --NotebookApp.token\='${token}'
    ${path args} =    Set Variable    --LabApp.user_settings_dir='${SETTINGS DIR.replace('\\', '\\\\')}' --LabApp.workspaces_dir\='${WORKSPACES DIR.replace('\\', '\\\\')}'
    ${ext args} =    Set Variable    --LanguageServerManager.extra_node_roots\="['${root.replace('\\', '\\\\')}']"
    Set Screenshot Directory    ${OUTPUT DIR}${/}screenshots
    ${server} =    Start Process    jupyter-lab ${app args} ${path args} ${ext args}    shell=yes    env:HOME=${home}    cwd=${home}    stdout=${OUTPUT DIR}${/}lab.log
    ...    stderr=STDOUT
    Set Global Variable    ${SERVER}    ${server}
    Open JupyterLab
    ${script} =    Get Element Attribute    id:jupyter-config-data    innerHTML
    ${config} =    Evaluate    __import__("json").loads("""${script}""")
    Set Global Variable    ${PAGE CONFIG}    ${config}
    Set Global Variable    ${LAB VERSION}    ${config["appVersion"]}

Setup Suite For Screenshots
    [Arguments]    ${folder}
    Set Screenshot Directory    ${OUTPUT DIR}${/}screenshots${/}${folder}
    Set Tags    lab:${LAB VERSION}

Initialize User Settings
    Set Suite Variable    ${SETTINGS DIR}    ${OUTPUT DIR}${/}user-settings    children=${True}
    Create File    ${SETTINGS DIR}${/}@jupyterlab${/}codemirror-extension${/}commands.jupyterlab-settings    {"styleActiveLine": true}

Tear Down Everything
    Close All Browsers
    Evaluate    __import__("urllib.request").request.urlopen("${URL}api/shutdown?token=${TOKEN}", data=[])
    Wait For Process    ${SERVER}    timeout=30s
    Terminate All Processes
    Terminate All Processes    kill=${True}

Wait For Splash
    Wait Until Page Contains Element    ${SPLASH}    timeout=180s
    Wait Until Page Does Not Contain Element    ${SPLASH}    timeout=180s
    Execute Javascript    window.onbeforeunload \= function (){}

Open JupyterLab
    Set Environment Variable    MOZ_HEADLESS    ${HEADLESS}
    ${firefox} =    Which    firefox
    ${geckodriver} =    Which    geckodriver
    Create WebDriver    Firefox    executable_path=${geckodriver}    firefox_binary=${firefox}    service_log_path=${OUTPUT DIR}${/}geckodriver.log
    Wait Until Keyword Succeeds    20x    3s    Go To    ${URL}lab?token=${TOKEN}
    Set Window Size    1024    768
    Wait For Splash

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
    Wait For Splash

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
    ${sel} =    Set Variable    css:.p-TabBar-tab[data-id="filebrowser"]:not(.p-mod-current)
    ${els} =    Get WebElements    ${sel}
    Run Keyword If    ${els.__len__()}    Click Element    ${sel}

Rename Jupyter File
    [Arguments]    ${old}    ${new}
    Ensure File Browser is Open
    Click Element    css:button[title="Refresh File List"]
    Open Context Menu    //span[@class='jp-DirListing-itemText']\[text() = '${old}']
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
    Ensure File Browser is Open
    Click Element    css:button[title="Refresh File List"]
    Open Context Menu    css:.jp-DirListing-item[title="${file}"]
    Mouse Over    ${MENU OPEN WITH}
    Wait Until Page Contains Element    ${editor}
    Mouse Over    ${editor}
    Click Element    ${editor}

Clean Up After Working With File
    [Arguments]    ${file}
    Remove File    ${OUTPUT DIR}${/}home${/}${file}
    Reset Application State

Setup Notebook
    [Arguments]    ${Language}    ${file}
    Set Tags    language:${Language.lower()}
    Set Screenshot Directory    ${OUTPUT DIR}${/}screenshots${/}notebook${/}${TEST NAME.replace(' ', '_')}
    Copy File    examples${/}${file}    ${OUTPUT DIR}${/}home${/}${file}
    Try to Close All Tabs
    Open ${file} in ${MENU NOTEBOOK}
    Capture Page Screenshot    00-opened.png
    Wait Until Fully Initialized
    Capture Page Screenshot    01-initialized.png

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

Wait Until Fully Initialized
    Wait Until Element Contains    ${STATUSBAR}    Fully initialized    timeout=60s

Open Context Menu Over
    [Arguments]    ${sel}
    Wait Until Keyword Succeeds    10 x    0.1 s    Mouse Over    ${sel}
    Wait Until Keyword Succeeds    10 x    0.1 s    Click Element    ${sel}
    Wait Until Keyword Succeeds    10 x    0.1 s    Open Context Menu    ${sel}
