import { Signal } from '@lumino/signaling';

import { kernelIcon, LabIcon } from '@jupyterlab/ui-components';

import {
  COMPLETER_THEME_PREFIX,
  ICompletionColorScheme,
  ICompletionIconSet,
  ICompletionTheme,
  ILSPCompletionThemeManager,
  KernelKind,
  TCompletionLabIcons
} from './types';

export class CompletionThemeManager implements ILSPCompletionThemeManager {
  protected themes: Map<string, ICompletionTheme>;
  protected color_schemes: Map<string, ICompletionColorScheme>;
  protected current_icons: TCompletionLabIcons;
  private current_theme_id: string;
  private current_color_scheme_id: string;
  private icons_cache: Map<string, LabIcon>;
  private _theme_registered: Signal<this, ICompletionTheme>;
  private _color_scheme_registered: Signal<this, ICompletionColorScheme>;

  constructor() {
    this.themes = new Map();
    this.color_schemes = new Map();
    this.icons_cache = new Map();
    this._theme_registered = new Signal(this);
    this._color_scheme_registered = new Signal(this);
  }

  register_theme(theme: ICompletionTheme) {
    const { id } = theme;
    if (this.themes.has(id)) {
      console.warn(`Theme ${id} already registered, overwriting.`);
    }
    this.themes.set(id, theme);
    this._theme_registered.emit(theme);
  }

  get theme_registered() {
    return this._theme_registered;
  }

  register_color_scheme(color_scheme: ICompletionColorScheme) {
    const { id } = color_scheme;
    if (this.color_schemes.has(id)) {
      console.warn(`Color scheme ${id} already registered, overwriting.`);
    }
    this.color_schemes.set(id, color_scheme);
    this._color_scheme_registered.emit(color_scheme);
  }
  get color_scheme_registered() {
    return this._color_scheme_registered;
  }

  get_current_color_scheme_id() {
    return this.current_color_scheme_id;
  }

  theme_ids() {
    return [...this.themes.keys()];
  }

  color_scheme_ids() {
    return [...this.color_schemes.keys()];
  }

  get_current_theme_id() {
    return this.current_theme_id;
  }

  get_theme(id: string | null) {
    return this.themes.get(id);
  }

  async get_icons(
    theme: ICompletionTheme,
    color_scheme: ICompletionColorScheme
  ): Promise<TCompletionLabIcons> {
    const icons: TCompletionLabIcons = new Map();

    for (const [completion_kind, raw] of Object.entries(
      await theme.icons.svg()
    )) {
      const name = `lsp:${theme.id}-${color_scheme.id}-${completion_kind}`.toLowerCase();
      let icon = this.icons_cache.get(name);
      if (icon == null) {
        let svgstr = color_scheme.transform(raw);
        icon = new LabIcon({ name, svgstr });
        this.icons_cache.set(name, icon);
      }
      icons.set(completion_kind as keyof ICompletionIconSet, icon);
    }
    return icons;
  }

  get_color_scheme(scheme_id: string) {
    return this.color_schemes.get(scheme_id);
  }

  set_color_scheme(scheme_id: string) {
    this.current_color_scheme_id = scheme_id;
  }

  protected async update_icons_set() {
    this.current_icons =
      this.current_theme?.id == null
        ? new Map()
        : await this.get_icons(this.current_theme, this.current_color_scheme);
  }

  get_icon(type: string): LabIcon {
    if (this.current_theme.id === null) {
      return null;
    }
    let options = this.current_theme.icons.options || {};
    if (type) {
      type =
        type.substring(0, 1).toUpperCase() + type.substring(1).toLowerCase();
    }
    if (this.current_icons.has(type as any)) {
      return this.current_icons.get(type as any).bindprops(options);
    }
    if (type === KernelKind) {
      return kernelIcon;
    }
    return null;
  }

  protected get current_theme_class() {
    return `${COMPLETER_THEME_PREFIX}-${this.current_theme_id}`;
  }

  async set_theme(id: string | null) {
    if (this.current_theme_id != null) {
      document.body.classList.remove(this.current_theme_class);
    }
    const theme = this.themes.get(id);
    if (theme == null) {
      console.warn(
        `[LSP][Completer] Icons theme ${id} cannot be set yet (it may be loaded later).`
      );
    }
    this.current_theme_id = id;
    if (id != null) {
      document.body.classList.add(this.current_theme_class);
    }
    await this.update_icons_set();
  }

  protected get current_theme(): ICompletionTheme | null {
    return this.themes.get(this.current_theme_id);
  }

  protected get current_color_scheme(): ICompletionColorScheme | null {
    return this.color_schemes.get(this.current_color_scheme_id);
  }
}
