import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { CodeEditor } from '@jupyterlab/codeeditor';
import {
  DocumentConnectionManager as DocumentConnectionManagerUpstream,
  ILSPDocumentConnectionManager as ILSPDocumentConnectionManagerUpstream,
  LanguageServerManager,
  WidgetLSPAdapter,
  Document
} from '@jupyterlab/lsp';
import { Widget } from '@lumino/widgets';
import { DocumentRegistry, IDocumentWidget } from '@jupyterlab/docregistry';


export interface ILSPDocumentConnectionManager extends ILSPDocumentConnectionManagerUpstream {
  adapterByModel: WeakMap<CodeEditor.IModel, WidgetLSPAdapter<IDocumentWidget<Widget, DocumentRegistry.IModel>>>;
}

class DocumentConnectionManager extends DocumentConnectionManagerUpstream implements ILSPDocumentConnectionManager {
  adapterByModel = new WeakMap();

  registerAdapter(
    path: string,
     adapter: WidgetLSPAdapter<IDocumentWidget<Widget, DocumentRegistry.IModel>>
  ): void {
    super.registerAdapter(path, adapter);
    for (const editor of adapter.editors) {
      this._addToMapping(editor.ceEditor, adapter);
    }
    adapter.editorAdded.connect((_, change) => {
      this._addToMapping(change.editor, adapter);
    });
  }

  private async _addToMapping(
    editorWrapper: Document.IEditor,
    adapter: WidgetLSPAdapter<IDocumentWidget<Widget, DocumentRegistry.IModel>>
  ) {
    const editorAccessor = editorWrapper;
    const codeEditor = await editorAccessor.ready();
    this.adapterByModel.set(codeEditor.model, adapter);
  }
}

export const CONNECTION_MANAGER_PROVIDER: JupyterFrontEndPlugin<ILSPDocumentConnectionManager> = {
  activate: (app: JupyterFrontEnd) => {
    const languageServerManager = new LanguageServerManager({});
    const connectionManager = new DocumentConnectionManager({
      languageServerManager
    })
    return connectionManager;
  },
  id: '@jupyter-lsp/juptyterlab-lsp:connection-manager',
  description: 'Provides the language server connection manager.',
  provides: ILSPDocumentConnectionManagerUpstream,
  autoStart: true
};
