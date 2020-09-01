import * as React from 'react';

import { LabIcon } from '@jupyterlab/ui-components';
import { VDomRenderer, VDomModel } from '@jupyterlab/apputils';

import {
  ILSPCompletionThemeManager,
  ICompletionTheme,
  ILicenseInfo,
  ICompletionColorScheme
} from '@krassowski/completion-theme/lib/types';

import { CodeCompletion as LSPCompletionSettings } from '../../_completion';

import '../../../style/settings/completion.css';
import { IFeatureSettings } from '../../feature';

type TThemeKindIcons = Map<string, LabIcon>;
type TThemeMap = Map<string, ICompletionTheme>;
type TColorSchemeMap = Map<string, ICompletionColorScheme>;

const CONFIG_CLASS = 'jp-LSPCompletion-Settings';
const TOKEN_QUERY = '.CodeMirror-line span[class*=cm]';
const TOKEN_LABEL_CLASS = 'jp-LSPCompletion-Settings-TokenLabel';
const ICON_PREVIEW_CLASS = 'jp-LSPCompletion-IconPreview';

export class SettingsEditor extends VDomRenderer<SettingsEditor.Model> {
  dispose() {
    this.model.dispose();
    super.dispose();
  }

  protected render() {
    const {
      themeIds,
      themes,
      colorSchemes,
      colorSchemeIds,
      settings,
      tokenNames,
      icons
    } = this.model;
    const { composite } = settings;

    this.addClass(CONFIG_CLASS);
    this.addClass('jp-RenderedHTMLCommon');

    return (
      <div>
        <header>
          <nav>
            <ul>
              <li>
                <a href="#completion-settings-completer-display">
                  Completer Display
                </a>
                <ul>
                  <li>
                    <a href="#completion-settings-continuous-hinting">
                      Continuous Hinting
                    </a>
                  </li>
                  <li>
                    <a href="#completion-settings-suppress-invoke-in">
                      Suppress In
                    </a>
                  </li>
                </ul>
              </li>
              <li>
                <a href="#completion-settings-documentation-box">
                  Documentation Box
                </a>
              </li>
              <li>
                <a href="#completion-settings-theme">Theme</a>
                <ul>
                  <li>
                    <a href="#completion-settings-theme-icons">Icons</a>
                  </li>
                  <li>
                    <a href="#completion-settings-theme-colors">Colors</a>
                  </li>
                </ul>
              </li>
              <li>
                <a href="#" data-commandlinker-command="settingeditor:open">
                  Advanced Settings...
                </a>
              </li>
            </ul>
          </nav>
        </header>

        <article>
          <section>
            <h2 id="completion-settings-completer-display">
              Completer Display
            </h2>
            <section>
              <h3 id="completion-settings-continuous-hinting">
                Continuous Hinting
              </h3>
              <blockquote>
                Show completions after every key stroke, as in <i>Hinterland</i>
                .
              </blockquote>
              <label>
                <input
                  type="checkbox"
                  defaultChecked={composite.continuousHinting}
                  onChange={e =>
                    settings.set('continuousHinting', e.currentTarget.checked)
                  }
                />{' '}
                Enabled
              </label>
            </section>

            <section>
              <h3 id="completion-settings-suppress-invoke-in">
                Suppress In Tokens
              </h3>
              <aside>
                <h4>Tokens in Open Documents</h4>
                <button
                  onClick={() => this.model.refresh().catch(console.warn)}
                  className="jp-mod-styled jp-mod-accept"
                >
                  {' '}
                  Refresh Tokens
                </button>
                <div>{tokenNames.map(this.renderToken)}</div>
              </aside>
              <blockquote>
                CodeMirror token names for which auto-invoke should be
                suppressed, including <i>magic</i> characters. The available
                token names vary between languages and magic characters.
              </blockquote>
              <input
                type="text"
                className="jp-mod-styled"
                value={composite.suppressInvokeIn.join(' ')}
                onChange={evt => {
                  settings.set(
                    'suppressInvokeIn',
                    evt.currentTarget.value.trim().split(/\s+/)
                  );
                }}
              />
            </section>
          </section>

          <section>
            <h2 id="completion-settings-documentation-box">
              Show Documentation Box
            </h2>
            <blockquote>
              Show a documentation of the currently selected completion
              suggestion.
            </blockquote>
            <label>
              <input
                type="checkbox"
                defaultChecked={composite.showDocumentation}
                onChange={e =>
                  settings.set('showDocumentation', e.currentTarget.checked)
                }
              />{' '}
              Enabled
            </label>
          </section>

          <section>
            <h2 id="completion-settings-theme">Theme</h2>
            <aside className={ICON_PREVIEW_CLASS}>
              <h4>Icon Preview</h4>
              {[...icons.entries()].map(this.renderKindIcon)}
            </aside>
            <section>
              <h3 id="completion-settings-theme-icons">Icons</h3>
              <blockquote>
                Pick an icon theme to display in the completer dialog.
              </blockquote>
              <table>
                <thead>
                  <tr>
                    <th>Theme</th>
                    <th>License</th>
                    <th>Modifications</th>
                  </tr>
                </thead>
                <tbody>
                  {themeIds.map(id => (
                    <tr key={id}>
                      <th>
                        <label>
                          <input
                            type="radio"
                            defaultValue={id}
                            name="completion-icon-theme"
                            checked={id === composite.theme}
                            onChange={e =>
                              settings.set(
                                'theme',
                                e.currentTarget.value || null
                              )
                            }
                          />
                          {themes.get(id).name}
                        </label>
                      </th>
                      {this.renderLicense(themes.get(id).icons?.license)}
                      <td>
                        <i>
                          {themes.get(id).icons?.license?.modifications || ''}
                        </i>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section>
              <h3 id="completion-settings-theme-colors">Color Scheme</h3>
              <blockquote>Pick an icon color scheme</blockquote>

              <table>
                <thead>
                  <tr>
                    <th>Color Scheme</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {colorSchemeIds.map(colorSchemeId => (
                    <tr key={colorSchemeId}>
                      <th>
                        <label>
                          <input
                            type="radio"
                            name="completion-icon-color-scheme"
                            checked={composite.colorScheme === colorSchemeId}
                            onChange={e =>
                              settings.set('colorScheme', colorSchemeId)
                            }
                          />
                          {colorSchemes.get(colorSchemeId).title}
                        </label>
                      </th>
                      <td>{colorSchemes.get(colorSchemeId).description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </section>
        </article>
      </div>
    );
  }

  // event handlers

  protected onTokenClicked = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const { settings } = this.model;
    const { value, checked } = evt.currentTarget;
    const { suppressInvokeIn } = settings.composite;
    if (checked) {
      settings.set('suppressInvokeIn', [...suppressInvokeIn, value]);
    } else {
      settings.set(
        'suppressInvokeIn',
        suppressInvokeIn.filter(t => t !== value)
      );
    }
  };

  // renderers
  protected renderToken = (token: string) => {
    const { settings } = this.model;
    return (
      <label key={token} className={TOKEN_LABEL_CLASS}>
        <code>
          <input
            type="checkbox"
            onChange={this.onTokenClicked}
            value={token}
            checked={settings.composite.suppressInvokeIn.indexOf(token) > -1}
          />
          {token}
        </code>
      </label>
    );
  };

  protected renderLicense(license: ILicenseInfo) {
    if (license == null) {
      return <th></th>;
    }
    return (
      <th>
        <a
          href={license.url}
          title={`${license.name} by ${license.licensor}`}
          target="_blank"
          rel="noreferrer"
        >
          {license.spdx}
        </a>
      </th>
    );
  }

  protected renderKindIcon = (entry: [string, LabIcon]) => {
    const [kind, icon] = entry;
    if (icon != null) {
      return (
        <label key={kind}>
          <icon.react width="16px" />
          {kind}
        </label>
      );
    } else {
      return <label key={kind}>{kind}</label>;
    }
  };
}

export namespace SettingsEditor {
  export class Model extends VDomModel {
    protected _manager: ILSPCompletionThemeManager;
    protected _themeIds: string[] = [];
    protected _colorSchemeIds: string[] = [];
    protected _icons: TThemeKindIcons = new Map();
    protected _kinds: string[] = [];
    protected _themes: TThemeMap = new Map();
    protected _colorSchemes: TColorSchemeMap = new Map();
    protected _settings: IFeatureSettings<LSPCompletionSettings>;
    protected _tokenNames: string[] = [];

    constructor(options: IOptions) {
      super();
      this._manager = options.iconsThemeManager;
      this._settings = options.settings;
      this._settings.changed.connect(this.onSettingsChanged, this);
      this.refresh().catch(console.error);
    }

    dispose() {
      this._settings.changed.disconnect(this.onSettingsChanged, this);
      super.dispose();
    }

    get settings() {
      return this._settings;
    }

    get themeIds() {
      return this._themeIds;
    }

    get themes() {
      return this._themes;
    }

    get colorSchemeIds() {
      return this._colorSchemeIds;
    }

    get colorSchemes() {
      return this._colorSchemes;
    }

    get kinds() {
      return this._kinds;
    }

    get icons() {
      return this._icons;
    }

    get tokenNames() {
      return this._tokenNames;
    }

    get iconsThemeManager() {
      return this._manager;
    }

    protected onSettingsChanged() {
      this.refresh().catch(console.warn);
    }

    protected refreshTokenNames() {
      const names: string[] = [];
      for (const el of document.querySelectorAll(TOKEN_QUERY)) {
        for (const cls of el.classList) {
          if (cls.indexOf('cm-lsp') > -1) {
            continue;
          }
          const name = cls.replace(/^cm-/, '');
          if (names.indexOf(name) < 0) {
            names.push(name);
          }
        }
      }
      names.sort();
      return names;
    }

    async refresh() {
      const { _manager } = this;
      const themeIds = _manager.theme_ids();
      themeIds.sort((a, b) =>
        a == null ? 1 : b == null ? -1 : a.localeCompare(b)
      );

      const colorSchemeIds = _manager.color_scheme_ids();
      colorSchemeIds.sort();

      let icons: TThemeKindIcons = new Map();
      let kinds: string[] = [];
      const themes: TThemeMap = new Map();
      const schemes: TColorSchemeMap = new Map();

      for (const themeId of themeIds) {
        themes.set(themeId, _manager.get_theme(themeId));
      }

      for (const colorSchemeId of colorSchemeIds) {
        schemes.set(colorSchemeId, _manager.get_color_scheme(colorSchemeId));
      }

      const themeId = this.settings.composite.theme;
      const colorSchemeId = this.settings.composite.colorScheme;

      if (themeId && colorSchemeId) {
        const theme = themes.get(themeId);
        const color_scheme = schemes.get(colorSchemeId);
        themes.set(themeId, theme);
        const theme_icons = await _manager.get_icons(theme, color_scheme);
        for (const [kind, icon] of theme_icons.entries()) {
          icons.set(kind, icon);
          if (kinds.indexOf(kind) < 0) {
            kinds.push(kind);
          }
        }
      }

      kinds.sort();
      this._themeIds = themeIds;
      this._colorSchemeIds = colorSchemeIds;
      this._kinds = kinds;
      this._icons = icons;
      this._themes = themes;
      this._tokenNames = this.refreshTokenNames();
      this._colorSchemes = schemes;
      this.stateChanged.emit(void 0);
    }
  }

  export interface IOptions {
    iconsThemeManager: ILSPCompletionThemeManager;
    settings: IFeatureSettings<LSPCompletionSettings>;
  }
}
