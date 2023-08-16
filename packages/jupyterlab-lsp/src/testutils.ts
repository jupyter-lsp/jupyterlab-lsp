import { ICellModel } from '@jupyterlab/cells';
import { CodeEditor } from '@jupyterlab/codeeditor';
import {
  CodeMirrorEditorFactory,
  EditorLanguageRegistry,
  CodeMirrorMimeTypeService
} from '@jupyterlab/codemirror';
import {
  Context,
  IDocumentWidget,
  TextModelFactory,
  DocumentRegistry
} from '@jupyterlab/docregistry';
import { FileEditor, FileEditorFactory } from '@jupyterlab/fileeditor';
import {
  WidgetLSPAdapter,
  LanguageServerManager,
  CodeExtractorsManager,
  DocumentConnectionManager,
  FeatureManager,
  ISocketConnectionOptions,
  ILSPOptions
} from '@jupyterlab/lsp';
import { LSPConnection } from '@jupyterlab/lsp/lib/connection';
import * as nbformat from '@jupyterlab/nbformat';
import {
  Notebook,
  NotebookModel,
  NotebookModelFactory,
  NotebookPanel
} from '@jupyterlab/notebook';
import { NBTestUtils } from '@jupyterlab/notebook/lib/testutils';
import { ServiceManagerMock } from '@jupyterlab/services/lib/testutils';
import { nullTranslator } from '@jupyterlab/translation';
import { Signal } from '@lumino/signaling';
import type * as lsProtocol from 'vscode-languageserver-protocol';
import type { MessageConnection } from 'vscode-ws-jsonrpc';

import { FileEditorAdapter } from './adapters/fileeditor';
import { NotebookAdapter } from './adapters/notebook';
import { IFeatureSettings } from './feature';
import { CodeOverridesManager } from './overrides';
import { VirtualDocument } from './virtual/document';

import createNotebookPanel = NBTestUtils.createNotebookPanel;

const DEFAULT_SERVER_ID = 'pylsp';

export interface ITestEnvironment {
  documentOptions: VirtualDocument.IOptions;

  adapter: WidgetLSPAdapter<any>;
  init(): void;

  dispose(): void;
}

export class MockLanguageServerManager extends LanguageServerManager {
  async fetchSessions() {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this._sessions = new Map();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this._sessions.set(DEFAULT_SERVER_ID, {
      spec: {
        languages: ['python']
      }
    } as any);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this._sessionsChanged.emit(void 0);
  }
}

export class MockSettings<T> implements IFeatureSettings<T> {
  changed: Signal<IFeatureSettings<T>, void>;

  constructor(private settings: T) {
    this.changed = new Signal(this);
  }

  get composite(): Required<T> {
    return this.settings as Required<T>;
  }

  set(setting: keyof T, value: any): void {
    this.settings[setting] = value;
  }
}

namespace MockConnection {
  export interface IOptions extends ILSPOptions {
    serverCapabilities: lsProtocol.ServerCapabilities;
  }
}

class MockConnection extends LSPConnection {
  constructor(protected options: MockConnection.IOptions) {
    super(options);
  }

  //get isReady(): boolean {
  //  return true;
  //}
  connect(ws: any): void {
    this.connection = new MockMessageConnection() as MessageConnection;
    this.onServerInitialized({
      capabilities: this.options.serverCapabilities
    });
    this._isConnected = true;
  }
}

namespace MockDocumentConnectionManager {
  export interface IOptions extends DocumentConnectionManager.IOptions {
    connection?: Partial<MockConnection.IOptions>;
  }
}

class MockMessageConnection implements Partial<MessageConnection> {
  onError(handler: any): any {
    // no-op
  }
  onNotification(handler: any): any {
    // no-op
  }
  onRequest(hander: any): any {
    // no-op
  }
  sendNotification(handler: any): Promise<void> {
    return Promise.resolve();
  }
}

class MockDocumentConnectionManager extends DocumentConnectionManager {
  constructor(protected options: MockDocumentConnectionManager.IOptions) {
    super(options);
  }

  get ready() {
    return Promise.resolve();
  }
  async connect(
    options: ISocketConnectionOptions,
    firstTimeoutSeconds?: number,
    secondTimeoutMinutes?: number
  ) {
    let { language, capabilities, virtualDocument } = options;

    this.connectDocumentSignals(virtualDocument);

    const uris = {
      server: '',
      base: ''
    };
    const matchingServers = this.languageServerManager.getMatchingServers({
      language
    });

    const languageServerId =
      matchingServers.length === 0 ? null : matchingServers[0];
    if (!uris) {
      return;
    }
    const connection = new MockConnection({
      languageId: language,
      serverUri: uris.server,
      rootUri: uris.base,
      serverIdentifier: languageServerId!,
      capabilities: capabilities,
      serverCapabilities: {},
      ...this.options.connection
    });
    connection.connect(null);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this._connected.emit({ connection, virtualDocument });
    return connection;
  }
}

export abstract class TestEnvironment implements ITestEnvironment {
  adapter: WidgetLSPAdapter<any>;
  abstract widget: IDocumentWidget;
  protected abstract getDefaults(): VirtualDocument.IOptions;
  public documentOptions: VirtualDocument.IOptions;

  constructor(
    protected options?: {
      document?: Partial<VirtualDocument.IOptions>;
      connection?: Partial<MockConnection.IOptions>;
    }
  ) {
    this.documentOptions = {
      ...this.getDefaults(),
      ...(options?.document || {})
    };
  }

  protected abstract createWidget(): IDocumentWidget;
  protected abstract getAdapterType():
    | typeof FileEditorAdapter
    | typeof NotebookAdapter;

  get activeEditor(): CodeEditor.IEditor {
    return this.adapter.activeEditor!.getEditor()!;
  }

  connectionManager: MockDocumentConnectionManager;

  async init() {
    this.widget = this.createWidget();
    let adapterType = this.getAdapterType();
    const docRegistry = new DocumentRegistry();
    this.connectionManager = new MockDocumentConnectionManager({
      languageServerManager: new MockLanguageServerManager({}),
      connection: this.options?.connection
    });

    const { foreignCodeExtractors, overridesRegistry } = this.documentOptions;
    const overridesManager = new CodeOverridesManager();
    for (let language of Object.keys(overridesRegistry)) {
      const cellOverrides = overridesRegistry[language].cell;
      for (const cell of cellOverrides) {
        overridesManager.register(
          {
            scope: 'cell',
            pattern: cell.pattern,
            replacement: cell.replacement,
            reverse: cell.reverse as any
          },
          language
        );
      }
      const lineOverrides = overridesRegistry[language].line;
      for (const line of lineOverrides) {
        overridesManager.register(
          {
            scope: 'line',
            pattern: line.pattern,
            replacement: line.replacement,
            reverse: line.reverse as any
          },
          language
        );
      }
    }
    this.adapter = new adapterType(this.widget as any, {
      docRegistry,
      connectionManager: this.connectionManager,
      codeOverridesManager: overridesManager,
      featureManager: new FeatureManager(),
      foreignCodeExtractorsManager: foreignCodeExtractors,
      translator: nullTranslator
    });
    await this.widget.context.sessionContext.ready;
    await this.connectionManager.ready;
    await this.adapter.ready;
  }

  dispose(): void {
    this.adapter.dispose();
  }
}

class MockNotebookAdapter extends NotebookAdapter {
  get language() {
    return 'python';
  }
  isReady(): boolean {
    return true;
  }
}

export class FileEditorTestEnvironment extends TestEnvironment {
  protected getAdapterType() {
    return FileEditorAdapter;
  }
  widget: IDocumentWidget<FileEditor>;

  protected getDefaults(): VirtualDocument.IOptions {
    return {
      language: 'python',
      path: 'dummy.py',
      fileExtension: 'py',
      hasLspSupportedFile: true,
      standalone: true,
      overridesRegistry: {},
      foreignCodeExtractors: new CodeExtractorsManager()
    };
  }

  createWidget(): IDocumentWidget {
    const languages = new EditorLanguageRegistry();
    let factory = new FileEditorFactory({
      editorServices: {
        factoryService: new CodeMirrorEditorFactory({ languages }),
        mimeTypeService: new CodeMirrorMimeTypeService(languages)
      },
      factoryOptions: {
        name: 'Editor',
        fileTypes: ['*']
      }
    });
    const context = new Context({
      manager: new ServiceManagerMock(),
      factory: new TextModelFactory(),
      path: this.documentOptions.path
    });
    void context.initialize(true);
    void context.sessionContext.initialize();
    return factory.createNew(context);
  }

  dispose(): void {
    super.dispose();
  }
}

export class NotebookTestEnvironment extends TestEnvironment {
  public widget: NotebookPanel;
  protected getAdapterType() {
    return MockNotebookAdapter;
  }

  get notebook(): Notebook {
    return this.widget.content;
  }

  protected getDefaults(): VirtualDocument.IOptions {
    return {
      language: 'python',
      path: 'notebook.ipynb',
      fileExtension: 'py',
      overridesRegistry: {},
      foreignCodeExtractors: new CodeExtractorsManager(),
      hasLspSupportedFile: false,
      standalone: true
    };
  }

  createWidget(): IDocumentWidget {
    const startKernel = true;
    let context = new Context({
      manager: new ServiceManagerMock(),
      factory: new NotebookModelFactory({}),
      path: this.documentOptions.path,
      kernelPreference: {
        shouldStart: startKernel,
        canStart: startKernel,
        autoStartDefault: startKernel
      }
    });
    void context.initialize(true);
    void context.sessionContext.initialize();
    return createNotebookPanel(context);
  }
}

export function code_cell(
  source: string[] | string,
  metadata: Partial<nbformat.ICodeCellMetadata> = { trusted: false }
) {
  return {
    cell_type: 'code',
    source: source,
    metadata: metadata,
    execution_count: null,
    outputs: []
  } as nbformat.ICodeCell;
}

export function set_notebook_content(
  notebook: Notebook,
  cells: nbformat.ICodeCell[],
  metadata = python_notebook_metadata
) {
  let test_notebook = {
    cells: cells,
    metadata: metadata
  } as nbformat.INotebookContent;

  notebook.model = new NotebookModel();
  notebook.model.fromJSON(test_notebook);
}

export const python_notebook_metadata = {
  kernelspec: {
    display_name: 'Python [default]',
    language: 'python',
    name: 'python3'
  },
  language_info: {
    codemirror_mode: {
      name: 'ipython',
      version: 3
    },
    fileExtension: '.py',
    mimetype: 'text/x-python',
    name: 'python',
    nbconvert_exporter: 'python',
    pygments_lexer: 'ipython3',
    version: '3.5.2'
  },
  orig_nbformat: 4.1
} as nbformat.INotebookMetadata;

export function showAllCells(notebook: Notebook) {
  notebook.show();
  // iterate over every cell to activate the editors
  for (let i = 0; i < notebook.model!.cells.length; i++) {
    notebook.activeCellIndex = i;
    notebook.activeCell!.show();
  }
}

export function getCellsJSON(notebook: Notebook): Array<nbformat.ICell> {
  let cells: Array<ICellModel> = [];
  for (let i = 0; i < notebook.model!.cells.length; i++) {
    cells.push(notebook.model!.cells.get(i));
  }
  return cells.map(cell => cell.toJSON());
}

export async function synchronize_content(
  environment: ITestEnvironment,
  adapter: WidgetLSPAdapter<any>
) {
  await environment.adapter.updateDocuments();
  try {
    // TODO
    await adapter.updateFinished;
  } catch (e) {
    console.warn(e);
  }
}
