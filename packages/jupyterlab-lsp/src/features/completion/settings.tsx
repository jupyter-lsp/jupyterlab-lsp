import * as React from 'react';

import { LabIcon } from '@jupyterlab/ui-components';
import { VDomRenderer, VDomModel } from '@jupyterlab/apputils';

import {
  ILSPCompletionThemeManager,
  ICompletionTheme,
  ILicenseInfo
} from '@krassowski/completion-theme/lib/types';

import { CodeCompletion as LSPCompletionSettings } from '../../_completion';

import '../../../style/config/completion.css';
import { FeatureSettings } from '../../feature';

type TThemeKindIcons = Map<string, LabIcon>;
type TThemeMap = Map<string, ICompletionTheme>;

const CONFIG_CLASS = 'jp-LSPCompletion-Settings';

export class SettingsEditor extends VDomRenderer<SettingsEditor.Model> {
  protected render() {
    const { theme_ids, kinds, icons, themes, settings } = this.model;
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
              </li>
              <li>
                <a href="#completion-settings-suppress-invoke">
                  Suppress Invoke
                </a>
              </li>
              <li>
                <a href="#completion-settings-icon-theme">Icon Theme</a>
              </li>
              <li>
                <a href="#completion-settings-icon-color-schema">
                  Icon Color Scheme
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
            <h2 id="completion-settings-suppress-invoke">Suppress Invoke</h2>
            <blockquote>
              An array of CodeMirror tokens for which the auto-invoke should be
              suppressed. The token names vary between languages (modes).
            </blockquote>
          </section>
          <section>
            <h2 id="completion-settings-icon-theme">
              Icon Theme <code>{composite.theme}</code>
            </h2>
            <blockquote>
              Pick an icon theme to use for symbol references, such as
              completion hints.
            </blockquote>
            <table>
              <thead>
                <tr>
                  <th>Current Theme</th>
                  {theme_ids.map((id, i) => (
                    <th key={i}>
                      <input
                        type="radio"
                        defaultValue={id}
                        name="current-theme"
                        checked={id === composite.theme}
                        onChange={e =>
                          settings.set('theme', e.currentTarget.value)
                        }
                      />
                    </th>
                  ))}
                </tr>
                <tr>
                  <th>Theme Name</th>
                  {theme_ids.map((id, i) => (
                    <th key={i}>{themes.get(id).name}</th>
                  ))}
                </tr>
                <tr>
                  <th>License</th>
                  {theme_ids.map((id, i) =>
                    this.renderLicense(themes.get(id).icons.license, i)
                  )}
                </tr>
              </thead>
              <tbody>
                {kinds.map(kind => this.renderKind(kind, theme_ids, icons))}
              </tbody>
            </table>
          </section>

          <section>
            <h2 id="completion-settings-icon-color-schema">
              Icon Color Scheme
            </h2>
            {['themed', 'greyscale'].map(v => (
              <label key={v}>
                <input
                  type="radio"
                  name="symbol-icon-color"
                  defaultChecked={composite.colorScheme === v}
                  onChange={e => settings.set('colorScheme', v)}
                />
                {v}
              </label>
            ))}
            <blockquote>Pick an icon color scheme</blockquote>
          </section>
        </article>
      </div>
    );
  }

  // renderers
  protected renderLicense(license: ILicenseInfo, key: number) {
    return (
      <th key={key}>
        <a
          href={license.link}
          title={`${license.name} by ${license.licensor}`}
          target="_blank"
          rel="noreferrer"
        >
          {license.abbreviation}
        </a>
      </th>
    );
  }

  protected renderKind(
    kind: string,
    theme_ids: string[],
    icons: TThemeKindIcons
  ) {
    return (
      <tr key={kind}>
        <th>{kind}</th>
        {theme_ids.map(id =>
          this.renderThemeKind(kind, id, icons.get(`${kind}-${id}`))
        )}
      </tr>
    );
  }

  protected renderThemeKind(
    kind: string,
    theme_id: string,
    icon: LabIcon | null
  ) {
    const key = `${kind}-${theme_id}`;
    if (icon != null) {
      return (
        <td key={key}>
          <icon.react />
        </td>
      );
    } else {
      return <td key={key}></td>;
    }
  }
}

export namespace SettingsEditor {
  export class Model extends VDomModel {
    _manager: ILSPCompletionThemeManager;
    _theme_ids: string[];
    _icons: TThemeKindIcons;
    _kinds: string[];
    _themes: TThemeMap;
    _settings: FeatureSettings<LSPCompletionSettings>;

    get settings() {
      return this._settings;
    }

    set settings(settings) {
      if (this._settings) {
        this._settings.changed.disconnect(this._onSettingsChanged, this);
      }
      this._settings = settings;
      if (this._settings) {
        this._settings.changed.connect(this._onSettingsChanged, this);
      }
      this.stateChanged.emit(void 0);
    }

    _onSettingsChanged() {
      this.refresh().catch(console.warn);
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

    get iconsThemeManager() {
      return this._manager;
    }

    set iconsThemeManager(manager) {
      this._manager = manager;
      if (manager != null) {
        this.refresh().catch(console.warn);
      } else {
        this._theme_ids = [];
        this._kinds = [];
        this._icons = new Map();
        this._themes = new Map();
        this.stateChanged.emit(void 0);
      }
    }

    async refresh() {
      const { iconsThemeManager: manager } = this;
      let theme_ids = manager.theme_ids();
      theme_ids.sort();

      let icons: TThemeKindIcons = new Map();
      let kinds: string[] = [];
      const themes: TThemeMap = new Map();

      for (const id of theme_ids) {
        const theme = manager.get_theme(id);
        themes.set(id, theme);
        const theme_icons = await manager.get_icons(
          theme,
          this.settings?.composite.colorScheme
        );
        for (const [kind, icon] of theme_icons.entries()) {
          icons.set(`${kind}-${id}`, icon as LabIcon);
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
      this.stateChanged.emit(void 0);
    }
  }
}
