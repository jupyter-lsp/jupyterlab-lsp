import { TranslationBundle } from '@jupyterlab/translation';
import { LabIcon } from '@jupyterlab/ui-components';
import React, { ReactElement } from 'react';

import {
  COMPLETER_THEME_PREFIX,
  ICompletionTheme,
  ILicenseInfo
} from './types';

function renderLicence(licence: ILicenseInfo): ReactElement {
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

function renderTheme(
  trans: TranslationBundle,
  theme: ICompletionTheme,
  getSet: IconSetGetter,
  isCurrent: boolean
): ReactElement {
  let icons: ReactElement[] = [];
  for (let [name, icon] of getSet(theme)) {
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
        {isCurrent ? trans.__(' (current)') : ''}
      </h4>
      <ul>
        <li key={'id'}>
          ID: <code>{theme.id}</code>
        </li>
        <li key={'licence'}>
          {trans.__('Licence: ')}
          {renderLicence(theme.icons.licence)}
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

export function renderThemesList(
  trans: TranslationBundle,
  props: {
    themes: ICompletionTheme[];
    current: ICompletionTheme | null;
    getSet: IconSetGetter;
  }
): React.ReactElement {
  let themes = props.themes.map(theme =>
    renderTheme(trans, theme, props.getSet, theme == props.current)
  );
  return <div>{themes}</div>;
}
