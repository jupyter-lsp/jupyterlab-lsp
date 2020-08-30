import * as React from 'react';

import { LabIcon } from '@jupyterlab/ui-components';
import { VDomRenderer, VDomModel } from '@jupyterlab/apputils';

import {
  ILSPCompletionThemeManager,
  ICompletionTheme,
  ILicenseInfo
} from '@krassowski/completion-theme/lib/types';

import { CodeCompletion as LSPCompletionSettings } from '../../_completion';

import '../../../style/settings/completion.css';
import { IFeatureSettings } from '../../feature';

type TThemeKindIcons = Map<string, LabIcon>;
type TThemeMap = Map<string, ICompletionTheme>;

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
    const { theme_ids, themes, settings, tokenNames, icons } = this.model;
    const { composite } = settings;

    this.addClass(CONFIG_CLASS);
    this.addClass('jp-RenderedHTMLCommon');

    return (
      <div>
        <header>
          <h1>Code Completion Settings</h1>
          <nav>
            <ul>
              <li>
                <a href="#completion-settings-documentation-box">
                  Show Documentation Box
                </a>
              </li>
              <li>
                <a href="#completion-settings-continuous-hinting">
                  Continuous Hinting
                </a>
                <ul>
                  <li>
                    <a href="#completion-settings-continuous-hinting-enable">
                      Enable
                    </a>
                  </li>
                  <li>
                    <a href="#completion-settings-continuous-hinting-suppress-in">
                      Suppress In
                    </a>
                  </li>
                </ul>
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
            <h2 id="completion-settings-documentation-box">
              Show Documentation Box
            </h2>
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
            <blockquote>
              Whether to show documentation box next to the completion
              suggestions.
            </blockquote>
          </section>

          <section>
            <h2 id="completion-settings-continuous-hinting">
              Continuous Hinting
            </h2>
            <section>
              <h3 id="completion-settings-continuous-hinting-enable">Enable</h3>
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
              <blockquote>
                Whether to enable continuous hinting (Hinterland mode).
              </blockquote>
            </section>

            <section>
              <h3 id="completion-settings-continuous-hinting-suppress-in">
                Suppress In
              </h3>
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
              <details>
                <summary>Detected Tokens...</summary>
                {tokenNames.map(this.renderToken)}
              </details>
              <blockquote>
                An array of CodeMirror tokens for which the auto-invoke should
                be suppressed. The token names vary between languages (modes).
              </blockquote>
            </section>
          </section>

          <section>
            <h2 id="completion-settings-theme">Theme</h2>
            <details>
              <summary>Icon Preview...</summary>
              <div className={ICON_PREVIEW_CLASS}>
                {[...icons.entries()].map(this.renderKindIcon)}
              </div>
            </details>
            <section>
              <h3 id="completion-settings-theme-icons">
                Icons <code>{composite.theme}</code>
              </h3>
              <blockquote>
                Pick an icon theme to use for symbol references, such as
                completion hints.
              </blockquote>
              <table>
                <thead>
                  <tr>
                    <th>Current Theme</th>
                    <th>Theme Name</th>
                    <th>License</th>
                  </tr>
                </thead>
                <tbody>
                  {theme_ids.map(id => (
                    <tr key={id}>
                      <th>{themes.get(id).name}</th>
                      {this.renderLicense(themes.get(id).icons.license)}
                      <td>
                        <input
                          type="radio"
                          defaultValue={id}
                          name="current-theme"
                          checked={id === composite.theme}
                          onChange={e =>
                            settings.set('theme', e.currentTarget.value)
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section>
              <h3 id="completion-settings-theme-colors">
                Colors <code>{composite.colorScheme}</code>
              </h3>
              {['themed', 'greyscale'].map(v => (
                <label key={v}>
                  <input
                    type="radio"
                    name="symbol-icon-color"
                    checked={composite.colorScheme === v}
                    onChange={e => settings.set('colorScheme', v)}
                  />
                  {v}
                </label>
              ))}
              <blockquote>Pick an icon color scheme</blockquote>
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
        <input
          type="checkbox"
          onChange={this.onTokenClicked}
          value={token}
          checked={settings.composite.suppressInvokeIn.indexOf(token) > -1}
        />
        <code>{token}</code>
      </label>
    );
  };

  protected renderLicense(license: ILicenseInfo) {
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
          <icon.react />
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
    protected _theme_ids: string[] = [];
    protected _icons: TThemeKindIcons = new Map();
    protected _kinds: string[] = [];
    protected _themes: TThemeMap = new Map();
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

    get theme_ids() {
      return this._theme_ids;
    }

    get themes() {
      return this._themes;
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
      let theme_ids = _manager.theme_ids();
      theme_ids.sort();

      let icons: TThemeKindIcons = new Map();
      let kinds: string[] = [];
      const themes: TThemeMap = new Map();

      for (const theme_id of theme_ids) {
        themes.set(theme_id, _manager.get_theme(theme_id));
      }

      const theme_id = this.settings.composite.theme;
      if (theme_id) {
        const theme = themes.get(theme_id);
        themes.set(theme_id, theme);
        const theme_icons = await _manager.get_icons(
          theme,
          this.settings?.composite.colorScheme
        );
        for (const [kind, icon] of theme_icons.entries()) {
          icons.set(kind, icon);
          if (kinds.indexOf(kind) < 0) {
            kinds.push(kind);
          }
        }
      }

      kinds.sort();
      this._theme_ids = theme_ids;
      this._kinds = kinds;
      this._icons = icons;
      this._themes = themes;
      this._tokenNames = this.refreshTokenNames();
      this.stateChanged.emit(void 0);
    }
  }

  export interface IOptions {
    iconsThemeManager: ILSPCompletionThemeManager;
    settings: IFeatureSettings<LSPCompletionSettings>;
  }
}
