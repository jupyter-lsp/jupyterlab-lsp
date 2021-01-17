""" default specs
"""
# flake8: noqa: F401

from .bash_language_server import BashLanguageServer
from .dockerfile_language_server_nodejs import DockerfileLanguageServerNodeJS
from .javascript_typescript_langserver import JavascriptTypescriptLanguageServer
from .jedi_language_server import JediLanguageServer
from .julia_language_server import JuliaLanguageServer
from .pyls import PythonLanguageServer
from .r_languageserver import RLanguageServer
from .sql_language_server import SQLLanguageServer
from .texlab import Texlab
from .unified_language_server import UnifiedLanguageServer
from .vscode_css_languageserver import VSCodeCSSLanguageServer
from .vscode_html_languageserver import VSCodeHTMLLanguageServer
from .vscode_json_languageserver import VSCodeJSONLanguageServer
from .yaml_language_server import YAMLLanguageServer

bash = BashLanguageServer()
css = VSCodeCSSLanguageServer()
dockerfile = DockerfileLanguageServerNodeJS()
html = VSCodeHTMLLanguageServer()
jedi = JediLanguageServer()
json = VSCodeJSONLanguageServer()
julia = JuliaLanguageServer()
md = UnifiedLanguageServer()
py = PythonLanguageServer()
r = RLanguageServer()
tex = Texlab()
ts = JavascriptTypescriptLanguageServer()
sql = SQLLanguageServer()
yaml = YAMLLanguageServer()
