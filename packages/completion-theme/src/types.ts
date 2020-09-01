import { Token } from '@lumino/coreutils';
import { LabIcon } from '@jupyterlab/ui-components';

export const COMPLETER_THEME_PREFIX = 'lsp-completer-theme';

export const RE_ICON_THEME_CLASS = /jp-icon[^" ]+/g;

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

export const PLUGIN_ID = '@krassowski/completion-manager';

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
   * License name.
   */
  name: string;
  /**
   * SPDX identifer of the license. See https://spdx.org/licenses
   */
  spdx: string;
  /**
   * The copyright holder/owner name.
   */
  licensor: string;
  /**
   * URL of the full license text.
   */
  url: string;
  /**
   * Modifications made to the icons, if any.
   */
  modifications?: string;
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
    license: ILicenseInfo;
    /**
     * The icons as SVG strings, keyed by completion kind.
     */
    svg(): Promise<ICompletionIconSet>;
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

export interface ICompletionColorScheme {
  /**
   * Scheme identifier
   */
  id: string;
  /**
   * Transforms an icon SVG string, usually by manipulating jp-icon* classes
   */
  transform(svg: string): string;

  title: string;

  description: string;
}

export type TCompletionLabIcons = Map<keyof ICompletionIconSet, LabIcon>;

export interface ILSPCompletionThemeManager {
  register_theme(theme: ICompletionTheme): void;

  register_color_scheme(schema: ICompletionColorScheme): void;

  theme_ids(): string[];

  color_scheme_ids(): string[];

  get_current_theme_id(): string;

  get_current_color_scheme_id(): string;

  set_theme(theme_id: string | null): void;

  get_theme(theme_id: string): ICompletionTheme;

  set_color_scheme(scheme_id: string): void;

  get_color_scheme(scheme_id: string): ICompletionColorScheme;

  get_icon(type: string): LabIcon | null;

  get_icons(
    theme: ICompletionTheme,
    color_scheme: ICompletionColorScheme
  ): Promise<TCompletionLabIcons>;
}

export const ILSPCompletionThemeManager = new Token<ILSPCompletionThemeManager>(
  `${PLUGIN_ID}:ILSPCompletionThemeManager`
);
