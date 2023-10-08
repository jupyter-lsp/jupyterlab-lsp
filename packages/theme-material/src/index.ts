import '../style/completer.css';
import {
  ICompletionIconSet,
  ICompletionTheme,
  ILSPCompletionThemeManager
} from '@jupyter-lsp/completion-theme';
import { JupyterFrontEndPlugin } from '@jupyterlab/application';

import alphaTOverCode from '../style/icons/alpha-t-and-code.svg';
import alphabetical from '../style/icons/alphabetical.svg';
import beaker from '../style/icons/beaker-outline.svg';
import snippet from '../style/icons/border-none-variant.svg';
import field from '../style/icons/checkbox-blank-circle-outline.svg';
import variable from '../style/icons/checkbox-blank-outline.svg';
import file from '../style/icons/file-outline.svg';
import fileReplace from '../style/icons/file-replace-outline.svg';
import structure from '../style/icons/file-tree.svg';
import lightning from '../style/icons/flash-outline.svg';
import folder from '../style/icons/folder-outline.svg';
import listNumbered from '../style/icons/format-list-numbered-rtl.svg';
import funcVariant from '../style/icons/function-variant.svg';
import func from '../style/icons/function.svg';
import hammerWrench from '../style/icons/hammer-wrench.svg';
import key from '../style/icons/key.svg';
import number from '../style/icons/numeric.svg';
import module from '../style/icons/package-variant-closed.svg';
import palette from '../style/icons/palette-outline.svg';
import plusMinus from '../style/icons/plus-minus-variant.svg';
import shield from '../style/icons/shield-outline.svg';
import sitemap from '../style/icons/sitemap.svg';
import value from '../style/icons/text.svg';
import connection from '../style/icons/transit-connection-horizontal.svg';
import wrench from '../style/icons/wrench.svg';

const defaultSet: ICompletionIconSet = {
  Text: alphabetical,
  Method: func,
  Function: funcVariant,
  Constructor: hammerWrench,
  Field: field,
  Variable: variable,
  Class: structure,
  Interface: connection,
  Module: module,
  Property: wrench,
  Unit: beaker,
  Value: value,
  Enum: listNumbered,
  Keyword: key,
  Snippet: snippet,
  Color: palette,
  File: file,
  Reference: fileReplace,
  Folder: folder,
  EnumMember: number,
  Constant: shield,
  Struct: sitemap,
  Event: lightning,
  Operator: plusMinus,
  TypeParameter: alphaTOverCode
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
    light: defaultSet
  }
};

export const plugin: JupyterFrontEndPlugin<void> = {
  // while for now it only styles completion,
  // we may decide to allow styling of more
  // components, reusing these plugins.
  id: '@jupyter-lsp/theme-material',
  requires: [ILSPCompletionThemeManager],
  activate: (app, completionThemeManager: ILSPCompletionThemeManager) => {
    completionThemeManager.registerTheme(completionTheme);
  },
  autoStart: true
};

export default plugin;
