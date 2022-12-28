import {
  ICompletionIconSet,
  ICompletionTheme,
  ILSPCompletionThemeManager
} from '@jupyter-lsp/completion-theme';
import { JupyterFrontEndPlugin } from '@jupyterlab/application';

import '../style/completer.css';
import dark_file from '../style/icons/dark/file.svg';
import dark_folder from '../style/icons/dark/folder.svg';
import dark_json from '../style/icons/dark/json.svg';
import dark_value from '../style/icons/dark/note.svg';
import dark_references from '../style/icons/dark/references.svg';
import dark_symbol_class from '../style/icons/dark/symbol-class.svg';
import dark_symbol_color from '../style/icons/dark/symbol-color.svg';
import dark_symbol_constant from '../style/icons/dark/symbol-constant.svg';
import dark_symbol_enumerator_member from '../style/icons/dark/symbol-enumerator-member.svg';
import dark_symbol_enumerator from '../style/icons/dark/symbol-enumerator.svg';
import dark_symbol_event from '../style/icons/dark/symbol-event.svg';
import dark_symbol_field from '../style/icons/dark/symbol-field.svg';
import dark_symbol_interface from '../style/icons/dark/symbol-interface.svg';
import dark_symbol_keyword from '../style/icons/dark/symbol-keyword.svg';
import dark_symbol_method from '../style/icons/dark/symbol-method.svg';
import dark_symbol_operator from '../style/icons/dark/symbol-operator.svg';
import dark_symbol_parameter from '../style/icons/dark/symbol-parameter.svg';
import dark_symbol_property from '../style/icons/dark/symbol-property.svg';
import dark_symbol_ruler from '../style/icons/dark/symbol-ruler.svg';
import dark_symbol_snippet from '../style/icons/dark/symbol-snippet.svg';
import dark_symbol_string from '../style/icons/dark/symbol-string.svg';
import dark_symbol_structure from '../style/icons/dark/symbol-structure.svg';
import dark_symbol_variable from '../style/icons/dark/symbol-variable.svg';
import file from '../style/icons/light/file.svg';
import folder from '../style/icons/light/folder.svg';
import json from '../style/icons/light/json.svg';
import value from '../style/icons/light/note.svg';
import references from '../style/icons/light/references.svg';
import symbol_class from '../style/icons/light/symbol-class.svg';
import symbol_color from '../style/icons/light/symbol-color.svg';
import symbol_constant from '../style/icons/light/symbol-constant.svg';
import symbol_enumerator_member from '../style/icons/light/symbol-enumerator-member.svg';
import symbol_enumerator from '../style/icons/light/symbol-enumerator.svg';
import symbol_event from '../style/icons/light/symbol-event.svg';
import symbol_field from '../style/icons/light/symbol-field.svg';
import symbol_interface from '../style/icons/light/symbol-interface.svg';
import symbol_keyword from '../style/icons/light/symbol-keyword.svg';
import symbol_method from '../style/icons/light/symbol-method.svg';
import symbol_operator from '../style/icons/light/symbol-operator.svg';
import symbol_parameter from '../style/icons/light/symbol-parameter.svg';
import symbol_property from '../style/icons/light/symbol-property.svg';
import symbol_ruler from '../style/icons/light/symbol-ruler.svg';
import symbol_snippet from '../style/icons/light/symbol-snippet.svg';
import symbol_string from '../style/icons/light/symbol-string.svg';
import symbol_structure from '../style/icons/light/symbol-structure.svg';
import symbol_variable from '../style/icons/light/symbol-variable.svg';

/**
 * Dark theme variants
 */

const light_set: ICompletionIconSet = {
  Text: symbol_string,
  Method: symbol_method,
  Function: symbol_method,
  Constructor: symbol_method,
  Field: symbol_field,
  Variable: symbol_variable,
  Class: symbol_class,
  Interface: symbol_interface,
  Module: json,
  Property: symbol_property,
  Unit: symbol_ruler,
  Value: value,
  Enum: symbol_enumerator,
  Keyword: symbol_keyword,
  Snippet: symbol_snippet,
  Color: symbol_color,
  File: file,
  Reference: references,
  Folder: folder,
  EnumMember: symbol_enumerator_member,
  Constant: symbol_constant,
  Struct: symbol_structure,
  Event: symbol_event,
  Operator: symbol_operator,
  TypeParameter: symbol_parameter
};

const dark_set: ICompletionIconSet = {
  Text: dark_symbol_string,
  Method: dark_symbol_method,
  Function: dark_symbol_method,
  Constructor: dark_symbol_method,
  Field: dark_symbol_field,
  Variable: dark_symbol_variable,
  Class: dark_symbol_class,
  Interface: dark_symbol_interface,
  Module: dark_json,
  Property: dark_symbol_property,
  Unit: dark_symbol_ruler,
  Value: dark_value,
  Enum: dark_symbol_enumerator,
  Keyword: dark_symbol_keyword,
  Snippet: dark_symbol_snippet,
  Color: dark_symbol_color,
  File: dark_file,
  Reference: dark_references,
  Folder: dark_folder,
  EnumMember: dark_symbol_enumerator_member,
  Constant: dark_symbol_constant,
  Struct: dark_symbol_structure,
  Event: dark_symbol_event,
  Operator: dark_symbol_operator,
  TypeParameter: dark_symbol_parameter
};

const completionTheme: ICompletionTheme = {
  id: 'vscode',
  name: 'VSCode',
  icons: {
    licence: {
      name: 'Creative Commons Attribution 4.0 International Public License',
      abbreviation: 'CC 4.0',
      licensor: 'Microsoft',
      link: 'https://github.com/microsoft/vscode-icons/blob/master/LICENSE'
    },
    light: light_set,
    dark: dark_set
  }
};

export const plugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyter-lsp/theme-vscode',
  requires: [ILSPCompletionThemeManager],
  activate: (app, completionThemeManager: ILSPCompletionThemeManager) => {
    completionThemeManager.register_theme(completionTheme);
  },
  autoStart: true
};

export default plugin;
