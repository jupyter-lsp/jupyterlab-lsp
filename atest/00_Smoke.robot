*** Settings ***
Suite Setup       Set Screenshot Directory    ${OUTPUT DIR}${/}screenshots${/}smoke
Resource          Keywords.robot

*** Test Cases ***
Lab Version
    Capture Page Screenshot    00-smoke.png
    ${script} =  Get Element Attribute    id:jupyter-config-data  innerHTML
    ${config} =  Evaluate  __import__("json").loads("""${script}""")
    Set Global Variable    ${PAGE CONFIG}    ${config}
    Set Global Variable    ${LAB VERSION}    ${config["appVersion"]}

Root URI
    [Documentation]  the rootUri should be set in the page config
    Should Not Be Empty    ${PAGE CONFIG["rootUri"]}
