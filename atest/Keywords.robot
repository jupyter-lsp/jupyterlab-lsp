*** Settings ***
Resource  Variables.robot
Library   SeleniumLibrary
Library   OperatingSystem
Library   Process
Library   String
Library   ./Ports.py


*** Keywords ***
Setup Server and Browser
    ${port} =  Get Unused Port
    Set Global Variable    ${PORT}    ${port}
    Set Global Variable    ${URL}  http://localhost:${PORT}${BASE}
    ${accel} =  Evaluate    "COMMAND" if "${OS}" == "Darwin" else "CTRL"
    Set Global Variable  ${ACCEL}  ${accel}
    ${token} =   Generate Random String
    Set Global Variable   ${TOKEN}   ${token}
    ${home} =  Set Variable  ${OUTPUT DIR}${/}home
    ${root} =  Normalize Path  ${OUTPUT DIR}${/}..${/}..${/}..
    Create Directory   ${home}
    ${WORKSPACES DIR} =   Set Variable    ${OUTPUT DIR}${/}workspaces
    Initialize User Settings
    ${app args} =   Set Variable   --no-browser --debug --NotebookApp.base_url\='${BASE}' --port\=${PORT} --NotebookApp.token\='${token}'
    ${path args} =  Set Variable   --LabApp.user_settings_dir='${SETTINGS DIR.replace('\\', '\\\\')}' --LabApp.workspaces_dir\='${WORKSPACES DIR.replace('\\', '\\\\')}'
    ${ext args} =  Set Variable  --LanguageServerManager.extra_node_roots\="['${root.replace('\\', '\\\\')}']"
    Set Screenshot Directory   ${OUTPUT DIR}${/}screenshots
    ${server} =  Start Process  jupyter-lab ${app args} ${path args} ${ext args}
    ...  shell=yes
    ...  env:HOME=${home}
    ...  cwd=${home}
    ...  stdout=${OUTPUT DIR}${/}lab.log
    ...  stderr=STDOUT
    Set Global Variable    ${SERVER}    ${server}
    Open JupyterLab

Initialize User Settings
    Set Suite Variable   ${SETTINGS DIR}   ${OUTPUT DIR}${/}user-settings  children=${True}
    Create File    ${SETTINGS DIR}${/}@jupyterlab${/}codemirror-extension${/}commands.jupyterlab-settings  {"styleActiveLine": true}

Tear Down Everything
    Close All Browsers
    Evaluate  __import__("urllib.request").request.urlopen("${URL}api/shutdown?token=${TOKEN}", data=[])
    Wait For Process   ${SERVER}  timeout=30s
    Terminate All Processes
    Terminate All Processes  kill=${True}

Wait For Splash
    Wait Until Page Contains Element   ${SPLASH}   timeout=180s
    Wait Until Page Does Not Contain Element   ${SPLASH}   timeout=180s
    Execute Javascript    window.onbeforeunload \= function (){}

Open JupyterLab
    Set Environment Variable    MOZ_HEADLESS    ${HEADLESS}
    ${firefox} =  Which  firefox
    ${geckodriver} =  Which  geckodriver
    Create WebDriver    Firefox    executable_path=${geckodriver}    firefox_binary=${firefox}  service_log_path=${OUTPUT DIR}${/}geckodriver.log
    Go To  ${URL}lab?token=${TOKEN}
    Set Window Size  1024  768
    Wait For Splash

Close JupyterLab
    Close All Browsers

Reset Application State
    Lab Command   Close All Tabs
    Ensure All Kernels Are Shut Down
    Lab Command   Reset Application State
    Wait For Splash
    Lab Command   Close All Tabs

Ensure All Kernels Are Shut Down
    Enter Command Name   Shut Down All Kernels
    ${els} =  Get WebElements   ${CMD PALETTE ITEM ACTIVE}
    Run Keyword If   ${els.__len__()}   Click Element    ${CMD PALETTE ITEM ACTIVE}
    Run Keyword If   ${els.__len__()}   Click Element  css:.jp-mod-accept.jp-mod-warn

Open Command Palette
    Press Keys  id:main  ${ACCEL}+SHIFT+c
    Wait Until Page Contains Element  ${CMD PALETTE INPUT}
    Click Element  ${CMD PALETTE INPUT}

Enter Command Name
    [Arguments]  ${cmd}
    Open Command Palette
    Input Text  ${CMD PALETTE INPUT}   ${cmd}

Lab Command
    [Arguments]  ${cmd}
    Enter Command Name  ${cmd}
    Wait Until Page Contains Element    ${CMD PALETTE ITEM ACTIVE}
    Click Element  ${CMD PALETTE ITEM ACTIVE}

Which
    [Arguments]  ${cmd}
    ${path} =  Evaluate    __import__("shutil").which("${cmd}")
    [Return]  ${path}
