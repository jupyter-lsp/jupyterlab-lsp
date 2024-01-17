import { Token } from '@lumino/coreutils';

import { PLUGIN_ID } from '../../tokens';

/**
 * Token provided by the plugin which implements LSP completion.
 * As of now no methods are exposed, but it still functions as
 * an indicator for whether the LSP completion plugin is available,
 * or whether it was disabled by the user (or failed to activate).
 */
export interface ICompletionFeature {
  readonly id: string;
}

export const ICompletionFeature = new Token<ICompletionFeature>(
  PLUGIN_ID + ':ICompletionFeature'
);
