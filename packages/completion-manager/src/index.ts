// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
/**
 * @packageDocumentation
 * @module completer-manager
 */

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICompletionManager } from '@jupyterlab/completer';

import { CompletionProviderManager } from './manager';
import { ICompletionProviderManager, PLUGIN_ID } from './tokens';

export * from './providers';
export * from './manager';
export * from './tokens';
export * from './model';

export const COMPLETION_MANAGER_PLUGIN: JupyterFrontEndPlugin<ICompletionProviderManager> =
  {
    id: PLUGIN_ID + ':extension',
    requires: [ICompletionManager],
    autoStart: true,
    provides: ICompletionProviderManager,
    activate: (app: JupyterFrontEnd, completionManager: ICompletionManager) => {
      return new CompletionProviderManager(app, completionManager);
    }
  };
export { DispatchRenderer } from './renderer';
