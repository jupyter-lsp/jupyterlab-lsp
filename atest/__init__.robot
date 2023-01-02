*** Settings ***
Resource            Keywords.resource

Suite Setup         Setup Server and Browser
Suite Teardown      Tear Down Everything
Test Teardown       Lab Log Should Not Contain Known Error Messages

Test Tags           os:${os.lower()}    py:${py}
