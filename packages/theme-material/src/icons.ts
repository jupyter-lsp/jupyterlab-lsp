import { ICompletionIconSet } from '@krassowski/completion-theme/lib/types';

import alphabetical from '../style/icons/alphabetical.svg';
import sitemap from '../style/icons/sitemap.svg';
import palette from '../style/icons/palette-outline.svg';
import plus_minus from '../style/icons/plus-minus-variant.svg';
import beaker from '../style/icons/beaker-outline.svg';
import module from '../style/icons/package-variant-closed.svg';
import func from '../style/icons/function.svg';
import func_variant from '../style/icons/function-variant.svg';
import connection from '../style/icons/transit-connection-horizontal.svg';
import value from '../style/icons/text.svg';
import list_numbered from '../style/icons/format-list-numbered-rtl.svg';
import variable from '../style/icons/checkbox-blank-outline.svg';
import field from '../style/icons/checkbox-blank-circle-outline.svg';
import hammer_wrench from '../style/icons/hammer-wrench.svg';
import wrench from '../style/icons/wrench.svg';
import file from '../style/icons/file-outline.svg';
import file_replace from '../style/icons/file-replace-outline.svg';
import folder from '../style/icons/folder-outline.svg';
import number from '../style/icons/numeric.svg';
import shield from '../style/icons/shield-outline.svg';
import structure from '../style/icons/file-tree.svg';
import lightning from '../style/icons/flash-outline.svg';
import key from '../style/icons/key.svg';
import snippet from '../style/icons/border-none-variant.svg';
import alpha_t_over_code from '../style/icons/alpha-t-and-code.svg';

export const iconSet: ICompletionIconSet = {
  Class: structure,
  Color: palette,
  Constant: shield,
  Constructor: hammer_wrench,
  Enum: list_numbered,
  EnumMember: number,
  Event: lightning,
  Field: field,
  File: file,
  Folder: folder,
  Function: func_variant,
  Interface: connection,
  Keyword: key,
  Method: func,
  Module: module,
  Operator: plus_minus,
  Property: wrench,
  Reference: file_replace,
  Snippet: snippet,
  Struct: sitemap,
  Text: alphabetical,
  TypeParameter: alpha_t_over_code,
  Unit: beaker,
  Value: value,
  Variable: variable
};
