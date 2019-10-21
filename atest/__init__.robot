*** Settings ***
Suite Setup       Setup Server and Browser
Suite Teardown    Tear Down Everything
Test Setup        Reset Application State
Force Tags        os:${OS.lower()}    py:${PY}
Resource          Keywords.robot
