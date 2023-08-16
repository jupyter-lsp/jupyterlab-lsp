import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  IAdapterOptions as IUpstreamIAdapterOptions,
  ILSPCodeExtractorsManager,
  ILSPFeatureManager,
  ILSPDocumentConnectionManager
} from '@jupyterlab/lsp';
import {
  NotebookAdapter as UpstreamNotebookAdapter,
  INotebookTracker,
  NotebookPanel
} from '@jupyterlab/notebook';

import { ILSPCodeOverridesManager } from '../overrides/tokens';
import { VirtualDocument } from '../virtual/document';

interface IAdapterOptions extends IUpstreamIAdapterOptions {
  codeOverridesManager: ILSPCodeOverridesManager;
}

export class NotebookAdapter extends UpstreamNotebookAdapter {
  constructor(
    public editorWidget: NotebookPanel,
    protected options: IAdapterOptions
  ) {
    super(editorWidget, options);
  }

  /**
   * Generate the virtual document associated with the document.
   */
  createVirtualDocument(): VirtualDocument {
    return new VirtualDocument({
      language: this.language,
      foreignCodeExtractors: this.options.foreignCodeExtractorsManager,
      path: this.documentPath,
      fileExtension: this.languageFileExtension,
      // notebooks are continuous, each cell is dependent on the previous one
      standalone: false,
      // notebooks are not supported by LSP servers
      hasLspSupportedFile: false,
      overridesRegistry: this.options.codeOverridesManager.registry
    });
  }
}

/**
 * Activate the language server for notebook.
 */
function activateNotebookLanguageServer(
  app: JupyterFrontEnd,
  notebooks: INotebookTracker,
  connectionManager: ILSPDocumentConnectionManager,
  featureManager: ILSPFeatureManager,
  codeExtractorManager: ILSPCodeExtractorsManager,
  codeOverridesManager: ILSPCodeOverridesManager
): void {
  notebooks.widgetAdded.connect(async (_, notebook) => {
    const adapter = new NotebookAdapter(notebook, {
      connectionManager,
      featureManager,
      foreignCodeExtractorsManager: codeExtractorManager,
      codeOverridesManager
    });
    connectionManager.registerAdapter(notebook.context.path, adapter);
  });
}

export const NOTEBOOK_ADAPTER_PLUGIN: JupyterFrontEndPlugin<void> = {
  id: '@jupyter-lsp/notebook-adapter',
  description: 'Adds language server capability to the notebooks.',
  requires: [
    INotebookTracker,
    ILSPDocumentConnectionManager,
    ILSPFeatureManager,
    ILSPCodeExtractorsManager,
    ILSPCodeOverridesManager
  ],
  activate: activateNotebookLanguageServer,
  autoStart: true
};
