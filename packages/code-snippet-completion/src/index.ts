import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICompletionProviderManager } from '@krassowski/completion-manager';

/**
 * Initialization data for the jupyterlab_apod extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: 'code-snippet-completion',
  autoStart: true,
  optional: [ICompletionProviderManager],
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension jupyterlab_apod is activated!');
  }
};

export default extension;
