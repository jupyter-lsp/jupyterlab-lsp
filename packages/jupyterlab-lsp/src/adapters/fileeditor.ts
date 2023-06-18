import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { IDocumentWidget } from '@jupyterlab/docregistry';
import {
  FileEditorAdapter as UpstreamFileEditorAdapter,
  FileEditor,
  IFileEditorAdapterOptions,
  IEditorTracker
} from '@jupyterlab/fileeditor';
import {
  ILSPCodeExtractorsManager,
  ILSPFeatureManager,
  ILSPDocumentConnectionManager
} from '@jupyterlab/lsp';

import { ILSPCodeOverridesManager } from '../overrides/tokens';
import { VirtualDocument } from '../virtual/document';


interface IAdapterOptions extends IFileEditorAdapterOptions {
  codeOverridesManager: ILSPCodeOverridesManager
}

class FileEditorAdapter extends UpstreamFileEditorAdapter {
  constructor(
    public editorWidget: IDocumentWidget<FileEditor>,
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
      standalone: true,
      // notebooks are not supported by LSP servers
      hasLspSupportedFile: true,
      overridesRegistry: this.options.codeOverridesManager.registry
    });
  }
}

/**
 * Activate the language server for file editor.
 */
function activateFileEditorLanguageServer(
  app: JupyterFrontEnd,
  editors: IEditorTracker,
  connectionManager: ILSPDocumentConnectionManager,
  featureManager: ILSPFeatureManager,
  extractorManager: ILSPCodeExtractorsManager,
  codeOverridesManager: ILSPCodeOverridesManager
): void {
    editors.widgetAdded.connect(async (_, editor) => {
    const adapter = new FileEditorAdapter(editor, {
      connectionManager,
      featureManager,
      foreignCodeExtractorsManager: extractorManager,
      docRegistry: app.docRegistry,
      codeOverridesManager
    });
    connectionManager.registerAdapter(editor.context.path, adapter);
  });
}

export const FILEEDITOR_ADAPTER_PLUGIN: JupyterFrontEndPlugin<void> = {
  id: '@jupyter-lsp/fileeditor-adapter',
  description: 'Adds language server capability to the notebooks.',
  requires: [
    IEditorTracker,
    ILSPDocumentConnectionManager,
    ILSPFeatureManager,
    ILSPCodeExtractorsManager,
    ILSPCodeOverridesManager
  ],
  activate: activateFileEditorLanguageServer,
  autoStart: true
};