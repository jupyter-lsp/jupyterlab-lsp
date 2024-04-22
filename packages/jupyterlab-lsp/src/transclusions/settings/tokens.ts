import { Token } from '@lumino/coreutils';
import { ISignal } from '@lumino/signaling';

import { PLUGIN_ID as PLUGIN_ID_BASE } from '../../tokens';

export const PLUGIN_ID = `${PLUGIN_ID_BASE}:transclusions`;

/**
 * An interface for settings-based extractors
 */
export interface ILSPCustomTransclusionsManager {
  /**
   * Fetch the settings and initialize extractors.
   */
  initialize(): Promise<void>;

  /**
   * A promise that resolves when the manager is initialized.
   */
  ready: Promise<void>;

  /**
   * A signal that emits when extractors change and are ready to be (re)used.
   */
  extractorsChanged: ISignal<ILSPCustomTransclusionsManager, void>;
}

/**
 * The dependency injection token for requiring the settings-based extractor manager.
 */
export const ILSPCustomTransclusionsManager =
  new Token<ILSPCustomTransclusionsManager>(
    `${PLUGIN_ID}:ILSPCustomTransclusionsManager`
  );
