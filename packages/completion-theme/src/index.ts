import '../style/index.css';
import { JupyterFrontEndPlugin } from '@jupyterlab/application';
import {
  Dialog,
  ICommandPalette,
  IThemeManager,
  showDialog
} from '@jupyterlab/apputils';
import { ITranslator, TranslationBundle } from '@jupyterlab/translation';
import { LabIcon, kernelIcon } from '@jupyterlab/ui-components';

import { renderThemesList } from './about';
import {
  COMPLETER_THEME_PREFIX,
  CompletionItemKindStrings,
  ICompletionIconSet,
  ICompletionTheme,
  ILSPCompletionThemeManager,
  KernelKind,
  PLUGIN_ID
} from './types';
export * from './types';

export class CompletionThemeManager implements ILSPCompletionThemeManager {
  protected currentIcons: Map<string, LabIcon>;
  protected themes: Map<string, ICompletionTheme>;
  private _currentThemeId: string | null = null;
  private _iconsCache: Map<string, LabIcon>;
  private _iconOverrides: Map<string, CompletionItemKindStrings>;
  private _trans: TranslationBundle;

  constructor(protected themeManager: IThemeManager, trans: TranslationBundle) {
    this.themes = new Map();
    this._iconsCache = new Map();
    this._iconOverrides = new Map();
    themeManager.themeChanged.connect(this.updateIconsSet, this);
    this._trans = trans;
  }

  protected isThemeLight() {
    const current = this.themeManager.theme;
    if (!current) {
      // assume true by default
      return true;
    }
    return this.themeManager.isLight(current);
  }

  getIconSet(theme: ICompletionTheme): Map<keyof ICompletionIconSet, LabIcon> {
    const iconsSets = theme.icons;
    const darkModeOnAndDarkSupported =
      !this.isThemeLight() && typeof iconsSets.dark !== 'undefined';
    const set: ICompletionIconSet = darkModeOnAndDarkSupported
      ? iconsSets.dark!
      : iconsSets.light;
    const icons: Map<keyof ICompletionIconSet, LabIcon> = new Map();
    let options = this.currentTheme?.icons?.options || {};
    const mode = this.isThemeLight() ? 'light' : 'dark';
    for (let [completionKind, svg] of Object.entries(set)) {
      let name =
        'lsp:' + theme.id + '-' + completionKind.toLowerCase() + '-' + mode;
      let icon: LabIcon;
      if (this._iconsCache.has(name)) {
        icon = this._iconsCache.get(name)!;
      } else {
        icon = new LabIcon({
          name: name,
          svgstr: svg
        });
        this._iconsCache.set(name, icon);
      }
      icons.set(
        completionKind as keyof ICompletionIconSet,
        icon.bindprops(options)
      );
    }
    return icons;
  }

  protected updateIconsSet() {
    if (this.currentTheme === null) {
      return;
    }
    this.currentIcons = this.getIconSet(this.currentTheme);
  }

  getIcon(type: string): LabIcon | null {
    if (this.currentTheme === null) {
      return null;
    }
    if (type) {
      if (this._iconOverrides.has(type.toLowerCase())) {
        type = this._iconOverrides.get(type.toLowerCase())!;
      }
      type =
        type.substring(0, 1).toUpperCase() + type.substring(1).toLowerCase();
    }
    if (this.currentIcons.has(type)) {
      return this.currentIcons.get(type)!;
    }

    if (type === KernelKind) {
      return kernelIcon;
    }
    return null;
  }

  protected get currentThemeClass() {
    return COMPLETER_THEME_PREFIX + this._currentThemeId;
  }

  setTheme(id: string | null) {
    if (this._currentThemeId) {
      document.body.classList.remove(this.currentThemeClass);
    }
    if (id && !this.themes.has(id)) {
      console.warn(
        `[LSP][Completer] Icons theme ${id} cannot be set yet (it may be loaded later).`
      );
    }
    this._currentThemeId = id;
    if (id !== null) {
      document.body.classList.add(this.currentThemeClass);
    }
    this.updateIconsSet();
  }

  protected get currentTheme(): ICompletionTheme | null {
    if (this._currentThemeId && this.themes.has(this._currentThemeId)) {
      return this.themes.get(this._currentThemeId)!;
    }
    return null;
  }

  registerTheme(theme: ICompletionTheme) {
    if (this.themes.has(theme.id)) {
      console.warn(
        'Theme with name',
        theme.id,
        'was already registered, overwriting.'
      );
    }
    this.themes.set(theme.id, theme);
    this.updateIconsSet();
  }

  /**
   * Display the registered themes in a dialog,
   * both for the user to know what they can choose from,
   * and for the developer to quickly check how the icons
   * from each theme would look rendered.
   */
  displayThemes() {
    showDialog({
      title: this._trans.__('LSP Completer Themes'),
      body: renderThemesList(this._trans, {
        themes: [...this.themes.values()],
        current: this.currentTheme,
        getSet: this.getIconSet.bind(this)
      }),
      buttons: [Dialog.okButton({ label: this._trans.__('OK') })]
    }).catch(console.warn);
  }

  setIconsOverrides(iconOverrides: Record<string, CompletionItemKindStrings>) {
    this._iconOverrides = new Map(
      Object.keys(iconOverrides).map(kernelType => [
        kernelType.toLowerCase(),
        iconOverrides[kernelType]
      ])
    );
  }
}

export const COMPLETION_THEME_MANAGER: JupyterFrontEndPlugin<ILSPCompletionThemeManager> =
  {
    id: PLUGIN_ID,
    requires: [IThemeManager, ICommandPalette, ITranslator],
    activate: (
      app,
      themeManager: IThemeManager,
      commandPalette: ICommandPalette,
      translator: ITranslator
    ) => {
      const trans = translator.load('jupyterlab_lsp');
      let manager = new CompletionThemeManager(themeManager, trans);
      const commandId = 'lsp:completer-about-themes';
      app.commands.addCommand(commandId, {
        label: trans.__('Display the completer themes'),
        execute: () => {
          manager.displayThemes();
        }
      });
      commandPalette.addItem({
        category: trans.__('Language server protocol'),
        command: commandId
      });
      return manager;
    },
    provides: ILSPCompletionThemeManager,
    autoStart: true
  };
