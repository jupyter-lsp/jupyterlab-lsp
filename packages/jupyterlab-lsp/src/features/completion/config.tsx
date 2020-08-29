import * as React from 'react';

import { LabIcon } from '@jupyterlab/ui-components';
import { VDomRenderer, VDomModel } from '@jupyterlab/apputils';

import { ILSPCompletionThemeManager } from '@krassowski/completion-theme/lib/types';

import '../../../style/config/completion.css';

type TThemeKindIcons = Map<string, LabIcon>;

const CONFIG_CLASS = 'jp-LSPCompletion-Config';

export class Configurer extends VDomRenderer<Configurer.Model> {
  onThemeChanged = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = evt.currentTarget as HTMLInputElement;
    this.model.iconsThemeManager.set_theme(value);
  };

  protected render() {
    const { theme_ids, kinds, icons } = this.model;
    const currentThemeId = this.model.iconsThemeManager.get_current_theme_id();

    this.addClass(CONFIG_CLASS);

    return (
      <div className={`jp-RenderedHTMLCommon`}>
        <header>
          <h1>Code Completion Settings</h1>
          <blockquote>
            Pick an icon theme to use for symbol references, such as completion
            hints.
          </blockquote>
          <h2>Icon Color Scheme</h2>
          <blockquote>Pick an icon color scheme</blockquote>
          <ul>
            {['colorful', 'monochrome'].map(v => (
              <li key={v}>
                <label>
                  <input type="radio" name="symbol-icon-color" />
                  {v}
                </label>
              </li>
            ))}
          </ul>
        </header>
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
                    checked={id === currentThemeId}
                    onChange={this.onThemeChanged}
                  />
                </th>
              ))}
            </tr>
            <tr>
              <th>Theme Name</th>
              {theme_ids.map((id, i) => (
                <th key={i}>
                  <code>{id}</code>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {kinds.map(kind => this.renderKind(kind, theme_ids, icons))}
          </tbody>
        </table>
      </div>
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

export namespace Configurer {
  export class Model extends VDomModel {
    _manager: ILSPCompletionThemeManager;
    _theme_ids: string[];
    _icons: TThemeKindIcons;
    _kinds: string[];

    get theme_ids() {
      return this._theme_ids;
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
        this.iconsThemeManager.current_theme_changed.connect(() => {
          this.stateChanged.emit(void 0);
        });
        this.refresh();
      } else {
        this._theme_ids = [];
        this._kinds = [];
        this._icons = new Map();
      }
      this.stateChanged.emit(void 0);
    }

    refresh() {
      const { iconsThemeManager: manager } = this;
      let theme_ids = manager.theme_ids();
      theme_ids.sort();

      let icons: TThemeKindIcons = new Map();
      let kinds: string[] = [];

      for (const id of theme_ids) {
        const theme = manager.get_theme(id);
        const theme_icons = manager.get_iconset(theme);
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
    }
  }
}
