import {
  ICompletionColorScheme,
  RE_ICON_THEME_CLASS
} from '@krassowski/completion-theme/lib/types';

export const defaultColorSchemes: ICompletionColorScheme[] = [
  {
    id: 'themed',
    title: 'Themed',
    description: 'Use Lab icon class names in SVG',
    transform: svg => svg
  },
  {
    id: 'unthemed',
    title: 'Unthemed',
    description:
      'Use raw colors from SVG (may not be compatible with all themes)',
    transform: svg => svg.replace(RE_ICON_THEME_CLASS, '')
  },
  {
    id: 'muted',
    title: 'Muted',
    description: 'Use muted theme icon color from current Lab theme',
    transform: svg => svg.replace(RE_ICON_THEME_CLASS, 'jp-icon4')
  }
];
