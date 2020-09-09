import { ICompletionIconSet } from '@krassowski/completion-theme/lib/types';

import symbol_string from '../style/icons/symbol-string.svg';
import symbol_method from '../style/icons/symbol-method.svg';
import symbol_field from '../style/icons/symbol-field.svg';
import symbol_variable from '../style/icons/symbol-variable.svg';
import symbol_class from '../style/icons/symbol-class.svg';
import symbol_interface from '../style/icons/symbol-interface.svg';
import json from '../style/icons/json.svg';
import symbol_property from '../style/icons/symbol-property.svg';
import symbol_ruler from '../style/icons/symbol-ruler.svg';
import value from '../style/icons/note.svg';
import symbol_enumerator from '../style/icons/symbol-enumerator.svg';
import symbol_keyword from '../style/icons/symbol-keyword.svg';
import symbol_snippet from '../style/icons/symbol-snippet.svg';
import symbol_color from '../style/icons/symbol-color.svg';
import file from '../style/icons/file.svg';
import references from '../style/icons/references.svg';
import folder from '../style/icons/folder.svg';
import symbol_enumerator_member from '../style/icons/symbol-enumerator-member.svg';
import symbol_constant from '../style/icons/symbol-constant.svg';
import symbol_structure from '../style/icons/symbol-structure.svg';
import symbol_event from '../style/icons/symbol-event.svg';
import symbol_operator from '../style/icons/symbol-operator.svg';
import symbol_parameter from '../style/icons/symbol-parameter.svg';

export const iconSet: ICompletionIconSet = {
  Class: symbol_class,
  Color: symbol_color,
  Constant: symbol_constant,
  Constructor: symbol_method,
  Enum: symbol_enumerator,
  EnumMember: symbol_enumerator_member,
  Event: symbol_event,
  Field: symbol_field,
  File: file,
  Folder: folder,
  Function: symbol_method,
  Interface: symbol_interface,
  Keyword: symbol_keyword,
  Method: symbol_method,
  Module: json,
  Operator: symbol_operator,
  Property: symbol_property,
  Reference: references,
  Snippet: symbol_snippet,
  Struct: symbol_structure,
  Text: symbol_string,
  TypeParameter: symbol_parameter,
  Unit: symbol_ruler,
  Value: value,
  Variable: symbol_variable
};
