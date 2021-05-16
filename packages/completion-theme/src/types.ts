import { LabIcon } from '@jupyterlab/ui-components';
import { Token } from '@lumino/coreutils';

export const COMPLETER_THEME_PREFIX = 'lsp-completer-theme-';

// TODO, once features are extracted to standalone packages,
//  import the CompletionItemKindStrings from @feature-completer
enum CompletionItemKind {
  Text = 1,
  Method = 2,
  Function = 3,
  Constructor = 4,
  Field = 5,
  Variable = 6,
  Class = 7,
  Interface = 8,
  Module = 9,
  Property = 10,
  Unit = 11,
  Value = 12,
  Enum = 13,
  Keyword = 14,
  Snippet = 15,
  Color = 16,
  File = 17,
  Reference = 18,
  Folder = 19,
  EnumMember = 20,
  Constant = 21,
  Struct = 22,
  Event = 23,
  Operator = 24,
  TypeParameter = 25
}

export type CompletionItemKindStrings = keyof typeof CompletionItemKind;

export const PLUGIN_ID = '@krassowski/completion-theme';

export type SvgString = string;

type requiredIcons = {
  [key in CompletionItemKindStrings]: SvgString;
};

export const KernelKind = 'Kernel';

export interface ICompletionIconSet extends requiredIcons {
  [KernelKind]?: SvgString;
}

export interface ILicenseInfo {
  /**
   * Licence name.
   */
  name: string;
  /**
   * Abbreviation of the licence name;
   */
  abbreviation: string;
  /**
   * The copyright holder/owner name.
   */
  licensor: string;
  /**
   * Link to the full licence text.
   */
  link: string;
}

export interface ICompletionTheme {
  /**
   * Theme identifier (which can be part of a valid HTML class name).
   */
  id: string;
  /**
   * Name of the theme.
   */
  name: string;
  /**
   * Provides object mapping completion item kind name to a string with an SVG icon,
   * as well as icons options and metadata.
   */
  icons: {
    /**
     * Short name of the license of the icons included.
     */
    licence: ILicenseInfo;
    /**
     * The version to be used in the light mode.
     */
    light: ICompletionIconSet;
    /**
     * The version to be used in the dark mode.
     */
    dark?: ICompletionIconSet;
    /**
     * Icon properties to be set on each of the icons.
     * NOTE: setting className here will not work, as
     * it would be overwritten in the completer.
     * In order to style the icons use:
     * `.lsp-completer-theme-{id} .jp-Completer-icon svg`
     * instead, where {id} is the identifier of your theme.
     */
    options?: LabIcon.IProps;
  };
}

export interface ILSPCompletionThemeManager {
  get_icon(type: string): LabIcon.ILabIcon | null;

  set_theme(theme_id: string | null): void;

  register_theme(theme: ICompletionTheme): void;

  get_iconset(
    theme: ICompletionTheme
  ): Map<keyof ICompletionIconSet, LabIcon.ILabIcon>;

  set_icons_overrides(
    map: Record<string, CompletionItemKindStrings | 'Kernel'>
  ): void;
}

export const ILSPCompletionThemeManager = new Token<ILSPCompletionThemeManager>(
  PLUGIN_ID + ':ILSPCompletionThemeManager'
);
