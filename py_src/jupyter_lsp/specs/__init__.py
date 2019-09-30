""" default specs
"""
# flake8: noqa: F401
from .javascript_typescript_langserver import JavascriptTypescriptLanguageServer
from .pyls import PythonLanguageServer
from .unified_language_server import UnifiedLanguageServer
from .vscode_css_languageserver import VSCodeCSSLanguageServer
from .vscode_html_languageserver import VSCodeHTMLLanguageServer
from .vscode_json_languageserver import VSCodeJSONLanguageServer
from .yaml_language_server import YAMLLanguageServer

ts = JavascriptTypescriptLanguageServer()
py = PythonLanguageServer()
css = VSCodeCSSLanguageServer()
html = VSCodeHTMLLanguageServer()
json = VSCodeJSONLanguageServer()
yaml = YAMLLanguageServer()
md = UnifiedLanguageServer()
