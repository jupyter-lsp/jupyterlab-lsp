import {
  ICompletionIconSet,
  ICompletionTheme,
  ILSPCompletionThemeManager
} from '@jupyter-lsp/completion-theme';
import { JupyterFrontEndPlugin } from '@jupyterlab/application';

import '../style/completer.css';
import darkFile from '../style/icons/dark/file.svg';
import darkFolder from '../style/icons/dark/folder.svg';
import darkJson from '../style/icons/dark/json.svg';
import darkValue from '../style/icons/dark/note.svg';
import darkReferences from '../style/icons/dark/references.svg';
import darkSymbolClass from '../style/icons/dark/symbol-class.svg';
import darkSymbolColor from '../style/icons/dark/symbol-color.svg';
import darkSymbolConstant from '../style/icons/dark/symbol-constant.svg';
import darkSymbolEnumeratorMember from '../style/icons/dark/symbol-enumerator-member.svg';
import darkSymbolEnumerator from '../style/icons/dark/symbol-enumerator.svg';
import darkSymbolEvent from '../style/icons/dark/symbol-event.svg';
import darkSymbolField from '../style/icons/dark/symbol-field.svg';
import darkSymbolInterface from '../style/icons/dark/symbol-interface.svg';
import darkSymbolKeyword from '../style/icons/dark/symbol-keyword.svg';
import darkSymbolMethod from '../style/icons/dark/symbol-method.svg';
import darkSymbolOperator from '../style/icons/dark/symbol-operator.svg';
import darkSymbolParameter from '../style/icons/dark/symbol-parameter.svg';
import darkSymbolProperty from '../style/icons/dark/symbol-property.svg';
import darkSymbolRuler from '../style/icons/dark/symbol-ruler.svg';
import darkSymbolSnippet from '../style/icons/dark/symbol-snippet.svg';
import darkSymbolString from '../style/icons/dark/symbol-string.svg';
import darkSymbolStructure from '../style/icons/dark/symbol-structure.svg';
import darkSymbolVariable from '../style/icons/dark/symbol-variable.svg';
import file from '../style/icons/light/file.svg';
import folder from '../style/icons/light/folder.svg';
import json from '../style/icons/light/json.svg';
import value from '../style/icons/light/note.svg';
import references from '../style/icons/light/references.svg';
import symbolClass from '../style/icons/light/symbol-class.svg';
import symbolColor from '../style/icons/light/symbol-color.svg';
import symbolConstant from '../style/icons/light/symbol-constant.svg';
import symbolEnumeratorMember from '../style/icons/light/symbol-enumerator-member.svg';
import symbolEnumerator from '../style/icons/light/symbol-enumerator.svg';
import symbolEvent from '../style/icons/light/symbol-event.svg';
import symbolField from '../style/icons/light/symbol-field.svg';
import symbolInterface from '../style/icons/light/symbol-interface.svg';
import symbolKeyword from '../style/icons/light/symbol-keyword.svg';
import symbolMethod from '../style/icons/light/symbol-method.svg';
import symbolOperator from '../style/icons/light/symbol-operator.svg';
import symbolParameter from '../style/icons/light/symbol-parameter.svg';
import symbolProperty from '../style/icons/light/symbol-property.svg';
import symbolRuler from '../style/icons/light/symbol-ruler.svg';
import symbolSnippet from '../style/icons/light/symbol-snippet.svg';
import symbolString from '../style/icons/light/symbol-string.svg';
import symbolStructure from '../style/icons/light/symbol-structure.svg';
import symbolVariable from '../style/icons/light/symbol-variable.svg';

/**
 * Dark theme variants
 */

const lightSet: ICompletionIconSet = {
  Text: symbolString,
  Method: symbolMethod,
  Function: symbolMethod,
  Constructor: symbolMethod,
  Field: symbolField,
  Variable: symbolVariable,
  Class: symbolClass,
  Interface: symbolInterface,
  Module: json,
  Property: symbolProperty,
  Unit: symbolRuler,
  Value: value,
  Enum: symbolEnumerator,
  Keyword: symbolKeyword,
  Snippet: symbolSnippet,
  Color: symbolColor,
  File: file,
  Reference: references,
  Folder: folder,
  EnumMember: symbolEnumeratorMember,
  Constant: symbolConstant,
  Struct: symbolStructure,
  Event: symbolEvent,
  Operator: symbolOperator,
  TypeParameter: symbolParameter
};

const darkSet: ICompletionIconSet = {
  Text: darkSymbolString,
  Method: darkSymbolMethod,
  Function: darkSymbolMethod,
  Constructor: darkSymbolMethod,
  Field: darkSymbolField,
  Variable: darkSymbolVariable,
  Class: darkSymbolClass,
  Interface: darkSymbolInterface,
  Module: darkJson,
  Property: darkSymbolProperty,
  Unit: darkSymbolRuler,
  Value: darkValue,
  Enum: darkSymbolEnumerator,
  Keyword: darkSymbolKeyword,
  Snippet: darkSymbolSnippet,
  Color: darkSymbolColor,
  File: darkFile,
  Reference: darkReferences,
  Folder: darkFolder,
  EnumMember: darkSymbolEnumeratorMember,
  Constant: darkSymbolConstant,
  Struct: darkSymbolStructure,
  Event: darkSymbolEvent,
  Operator: darkSymbolOperator,
  TypeParameter: darkSymbolParameter
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
    light: lightSet,
    dark: darkSet
  }
};

export const plugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyter-lsp/theme-vscode',
  requires: [ILSPCompletionThemeManager],
  activate: (app, completionThemeManager: ILSPCompletionThemeManager) => {
    completionThemeManager.registerTheme(completionTheme);
  },
  autoStart: true
};

export default plugin;
