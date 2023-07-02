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
//import { Signal } from '@lumino/signaling';


export interface ILSPDocumentConnectionManager extends ILSPDocumentConnectionManagerUpstream {
  adapterByModel: WeakMap<CodeEditor.IModel, WidgetLSPAdapter<IDocumentWidget<Widget, DocumentRegistry.IModel>>>;
}

class DocumentConnectionManager extends DocumentConnectionManagerUpstream implements ILSPDocumentConnectionManager {
  adapterByModel = new WeakMap();
  /*
  private _adapterRegistered = new Signal<DocumentConnectionManager, WidgetLSPAdapter<IDocumentWidget<Widget, DocumentRegistry.IModel>>>(this);
  get adapterRegistered() {
    return this._adapterRegistered;
  }
  */
  constructor(options: any) {
    console.warn('here');
    super(options);
  }

  registerAdapter(
    path: string,
    adapter: WidgetLSPAdapter<IDocumentWidget>
  ): void {
    super.registerAdapter(path, adapter);
      console.log('aaa');
    for (const editor of adapter.editors) {
      this._addToMapping(editor.ceEditor, adapter);
    }
    adapter.editorAdded.connect((_, change) => {
      this._addToMapping(change.editor, adapter);
    });
    //this._adapterRegistered.emit(adapter);
  }

  private async _addToMapping(
    editorWrapper: Document.IEditor,
    adapter: WidgetLSPAdapter<IDocumentWidget>
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
