import '../style/completer.css';
import { JupyterFrontEndPlugin } from '@jupyterlab/application';
import {
  ICompletionIconSet,
  ICompletionTheme,
  ILSPCompletionThemeManager
} from '@krassowski/completion-theme/lib/types';

import alpha_t_over_code from '../style/icons/alpha-t-and-code.svg';
import alphabetical from '../style/icons/alphabetical.svg';
import beaker from '../style/icons/beaker-outline.svg';
import snippet from '../style/icons/border-none-variant.svg';
import field from '../style/icons/checkbox-blank-circle-outline.svg';
import variable from '../style/icons/checkbox-blank-outline.svg';
import file from '../style/icons/file-outline.svg';
import file_replace from '../style/icons/file-replace-outline.svg';
import structure from '../style/icons/file-tree.svg';
import lightning from '../style/icons/flash-outline.svg';
import folder from '../style/icons/folder-outline.svg';
import list_numbered from '../style/icons/format-list-numbered-rtl.svg';
import func_variant from '../style/icons/function-variant.svg';
import func from '../style/icons/function.svg';
import hammer_wrench from '../style/icons/hammer-wrench.svg';
import key from '../style/icons/key.svg';
import number from '../style/icons/numeric.svg';
import module from '../style/icons/package-variant-closed.svg';
import palette from '../style/icons/palette-outline.svg';
import plus_minus from '../style/icons/plus-minus-variant.svg';
import shield from '../style/icons/shield-outline.svg';
import sitemap from '../style/icons/sitemap.svg';
import value from '../style/icons/text.svg';
import connection from '../style/icons/transit-connection-horizontal.svg';
import wrench from '../style/icons/wrench.svg';

const default_set: ICompletionIconSet = {
  Text: alphabetical,
  Method: func,
  Function: func_variant,
  Constructor: hammer_wrench,
  Field: field,
  Variable: variable,
  Class: structure,
  Interface: connection,
  Module: module,
  Property: wrench,
  Unit: beaker,
  Value: value,
  Enum: list_numbered,
  Keyword: key,
  Snippet: snippet,
  Color: palette,
  File: file,
  Reference: file_replace,
  Folder: folder,
  EnumMember: number,
  Constant: shield,
  Struct: sitemap,
  Event: lightning,
  Operator: plus_minus,
  TypeParameter: alpha_t_over_code
};

const completionTheme: ICompletionTheme = {
  id: 'material',
  name: 'Material Design',
  icons: {
    licence: {
      name: 'SIL Open Font License 1.1',
      abbreviation: 'OFL',
      licensor: 'Austin Andrews and Google',
      link: 'https://github.com/Templarian/MaterialDesign/blob/master/LICENSE'
    },
    light: default_set
  }
};

export const plugin: JupyterFrontEndPlugin<void> = {
  // while for now it only styles completion,
  // we may decide to allow styling of more
  // components, reusing these plugins.
  id: '@krassowski/theme-material',
  requires: [ILSPCompletionThemeManager],
  activate: (app, completionThemeManager: ILSPCompletionThemeManager) => {
    completionThemeManager.register_theme(completionTheme);
  },
  autoStart: true
};

export default plugin;
