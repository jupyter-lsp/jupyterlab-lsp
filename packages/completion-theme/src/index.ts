import { kernelIcon, LabIcon } from '@jupyterlab/ui-components';
import { JupyterFrontEndPlugin } from '@jupyterlab/application';

import {
  ICompletionIconSet,
  ICompletionTheme,
  ILSPCompletionThemeManager,
  PLUGIN_ID,
  COMPLETER_THEME_PREFIX,
  KernelKind,
  TCompletionLabIcons
} from './types';

const RE_ICON_THEME_CLASS = /jp-icon[^" ]+/g;
const GREYSCALE_CLASS = 'jp-icon4';

export class CompletionThemeManager implements ILSPCompletionThemeManager {
  protected current_icons: TCompletionLabIcons;
  protected themes: Map<string, ICompletionTheme>;
  private current_theme_id: string;
  private icons_cache: Map<string, LabIcon>;
  private color_scheme: string;

  constructor() {
    this.themes = new Map();
    this.icons_cache = new Map();
  }

  theme_ids() {
    return [...this.themes.keys()];
  }

  get_current_theme_id() {
    return this.current_theme_id;
  }

  get_theme(id: string) {
    return this.themes.get(id);
  }

  async get_icons(
    theme: ICompletionTheme,
    color_scheme: string
  ): Promise<TCompletionLabIcons> {
    const icons: TCompletionLabIcons = new Map();

    for (const [completion_kind, raw] of Object.entries(
      await theme.icons.svg()
    )) {
      const name = `lsp:${theme.id}-${completion_kind}-${color_scheme}`.toLowerCase();
      let icon = this.icons_cache.get(name);
      let svgstr = raw;
      if (color_scheme === 'greyscale') {
        svgstr = svgstr.replace(RE_ICON_THEME_CLASS, GREYSCALE_CLASS);
      }
      if (icon == null) {
        icon = new LabIcon({ name, svgstr });
        this.icons_cache.set(name, icon);
      }
      icons.set(completion_kind as keyof ICompletionIconSet, icon);
    }
    return icons;
  }

  get_color_scheme() {
    return this.color_scheme;
  }

  set_color_scheme(color_scheme: string) {
    this.color_scheme = color_scheme;
  }

  protected async update_icons_set() {
    if (this.current_theme === null) {
      return;
    }
    this.current_icons = await this.get_icons(
      this.current_theme,
      this.color_scheme
    );
  }

  get_icon(type: string): LabIcon {
    if (this.current_theme === null) {
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
    return COMPLETER_THEME_PREFIX + this.current_theme_id;
  }

  async set_theme(id: string | null) {
    if (this.current_theme_id) {
      document.body.classList.remove(this.current_theme_class);
    }
    if (!this.themes.has(id)) {
      console.warn(
        `[LSP][Completer] Icons theme ${id} cannot be set yet (it may be loaded later).`
      );
    }
    this.current_theme_id = id;
    document.body.classList.add(this.current_theme_class);
    await this.update_icons_set();
  }

  protected get current_theme(): ICompletionTheme | null {
    if (this.themes.has(this.current_theme_id)) {
      return this.themes.get(this.current_theme_id);
    }
    return null;
  }

  register_theme(theme: ICompletionTheme) {
    if (this.themes.has(theme.id)) {
      console.warn(
        'Theme with name',
        theme.id,
        'was already registered, overwriting.'
      );
    }
    this.themes.set(theme.id, theme);
  }
}

export const COMPLETION_THEME_MANAGER: JupyterFrontEndPlugin<ILSPCompletionThemeManager> = {
  id: PLUGIN_ID,
  activate: app => {
    let manager = new CompletionThemeManager();
    return manager;
  },
  provides: ILSPCompletionThemeManager,
  autoStart: true
};
