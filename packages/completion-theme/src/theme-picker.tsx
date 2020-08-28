import { VDomRenderer, VDomModel } from '@jupyterlab/apputils';

import * as React from 'react';
import { ILSPCompletionThemeManager } from './types';
import { LabIcon } from '@jupyterlab/ui-components';

type TThemeKindIcons = Map<string, LabIcon>;

const PICKER_CLASS = 'jp-LSPIconThemePicker';

export class IconThemePicker extends VDomRenderer<IconThemePicker.Model> {
  protected render() {
    const { theme_ids, kinds, icons } = this.model;

    this.addClass(PICKER_CLASS);

    return (
      <div className={`jp-RenderedHTMLCommon`}>
        <header>
          <h1>Symbol Icon Themes</h1>
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
                  <input type="radio" name="current-theme" />
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
          this.renderThemeKind(id, icons.get(`${kind}-${id}`))
        )}
      </tr>
    );
  }

  protected renderThemeKind(theme_id: string, icon: LabIcon | null) {
    if (icon != null) {
      return (
        <td>
          <icon.react />
        </td>
      );
    } else {
      return <td></td>;
    }
  }
}

export namespace IconThemePicker {
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

    get manager() {
      return this._manager;
    }

    set manager(manager) {
      this._manager = manager;
      if (manager != null) {
        let theme_ids = manager.theme_ids();
        theme_ids.sort();

        let icons: TThemeKindIcons = new Map();
        let kinds: string[] = [];

        for (const id of theme_ids) {
          const theme = manager.get_theme(id);
          const theme_icons = manager.get_icons_set(theme);
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
      } else {
        this._theme_ids = [];
        this._kinds = [];
        this._icons = new Map();
      }
      this.stateChanged.emit(void 0);
    }
  }
}
