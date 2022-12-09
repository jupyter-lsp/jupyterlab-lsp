*** Settings ***
Resource            Keywords.robot

Suite Setup         Setup Server and Browser
Suite Teardown      Tear Down Everything
Test Setup          Reset Application State
Test Teardown       Lab Log Should Not Contain Known Error Messages

Test Tags           os:${os.lower()}    py:${py}
