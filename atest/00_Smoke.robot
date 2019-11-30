*** Settings ***
Suite Setup       Set Screenshot Directory    ${OUTPUT DIR}${/}screenshots${/}smoke
Resource          Keywords.robot

*** Variables ***
${CSS CLOSE}      css:.jp-Dialog-button.jp-About-button

*** Test Cases ***
Lab Version
    Open With JupyterLab Menu    Help    About JupyterLab
    Wait Until Page Contains Element    ${JLAB CSS VERSION}
    ${version} =    Get WebElement    ${JLAB CSS VERSION}
    Set Global Variable    ${LAB VERSION}    ${version.text.split(" ")[-1]}
    Capture Page Screenshot    00-version.png
    Click Element    ${CSS CLOSE}
