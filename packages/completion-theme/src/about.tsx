import { TranslationBundle } from '@jupyterlab/translation';
import { LabIcon } from '@jupyterlab/ui-components';
import React, { ReactElement } from 'react';

import {
  COMPLETER_THEME_PREFIX,
  ICompletionTheme,
  ILicenseInfo
} from './types';

function render_licence(licence: ILicenseInfo): ReactElement {
  return (
    <div className={'lsp-licence'}>
      <a href={licence.link} title={licence.name}>
        {licence.abbreviation}
      </a>{' '}
      {licence.licensor}
    </div>
  );
}

type IconSetGetter = (theme: ICompletionTheme) => Map<string, LabIcon>;

function render_theme(
  trans: TranslationBundle,
  theme: ICompletionTheme,
  get_set: IconSetGetter,
  is_current: boolean
): ReactElement {
  let icons: ReactElement[] = [];
  for (let [name, icon] of get_set(theme)) {
    icons.push(
      <div className={'lsp-completer-icon-row'}>
        <div>{name}</div>
        <div className={'jp-Completer-icon'}>
          <icon.react />
        </div>
      </div>
    );
  }
  return (
    <div
      className={'lsp-completer-themes ' + COMPLETER_THEME_PREFIX + theme.id}
    >
      <h4>
        {theme.name}
        {is_current ? trans.__(' (current)') : ''}
      </h4>
      <ul>
        <li key={'id'}>
          ID: <code>{theme.id}</code>
        </li>
        <li key={'licence'}>
          {trans.__('Licence: ')}
          {render_licence(theme.icons.licence)}
        </li>
        <li key={'dark'}>
          {typeof theme.icons.dark === 'undefined'
            ? ''
            : trans.__('Includes dedicated dark mode icons set')}
        </li>
      </ul>
      <div className={'lsp-completer-theme-icons'}>{icons}</div>
    </div>
  );
}

export function render_themes_list(
  trans: TranslationBundle,
  props: {
    themes: ICompletionTheme[];
    current: ICompletionTheme;
    get_set: IconSetGetter;
  }
): React.ReactElement {
  let themes = props.themes.map(theme =>
    render_theme(trans, theme, props.get_set, theme == props.current)
  );
  return <div>{themes}</div>;
}
