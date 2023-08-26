import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  IAdapterOptions as IUpstreamIAdapterOptions,
  ILSPCodeExtractorsManager,
  ILSPFeatureManager,
  ILSPDocumentConnectionManager,
  Document
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

  protected async onForeignDocumentOpened(
    _: VirtualDocument,
    context: Document.IForeignContext
  ): Promise<void> {
    /*
    Opening a standalone foreign document can result in an inifnite loop,
    as a new connection gets opened for these, and once that is ready
    `updateDocuments()` gets called.

    To avoid the problem, `updateDocuments()` gets suppressed for standalone
    documents. It does not affect non-standalone documents, because no new
    connection gets opened for these.
    */
    try {
      this._blockUpdates = true;
      await super.onForeignDocumentOpened(_, context);
    } finally {
      this._blockUpdates = false;
    }
  }

  updateDocuments(): Promise<void> {
    if (this._blockUpdates) {
      return Promise.resolve();
    }
    return super.updateDocuments();
  }
  private _blockUpdates = false;
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
