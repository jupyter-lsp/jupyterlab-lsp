/*
import { ICellModel } from '@jupyterlab/cells';
import { CodeEditor } from '@jupyterlab/codeeditor';
import {
  CodeMirrorEditor,
  CodeMirrorEditorFactory,
  CodeMirrorMimeTypeService
} from '@jupyterlab/codemirror';
import {
  Context,
  IDocumentWidget,
  TextModelFactory
} from '@jupyterlab/docregistry';
import { FileEditor, FileEditorFactory } from '@jupyterlab/fileeditor';
import * as nbformat from '@jupyterlab/nbformat';
import {
  Notebook,
  NotebookModel,
  NotebookModelFactory,
  NotebookPanel
} from '@jupyterlab/notebook';
import { ServiceManager } from '@jupyterlab/services';
import { NBTestUtils } from '@jupyterlab/notebook/lib/testutils';
import { ServiceManagerMock } from '@jupyterlab/services/lib/testutils';
import { ILSPConnection, WidgetLSPAdapter, LanguageServerManager, CodeExtractorsManager } from '@jupyterlab/lsp';
import { LSPConnection } from '@jupyterlab/lsp/lib/connection';
import { Signal } from '@lumino/signaling';

import { FileEditorAdapter } from '@jupyterlab/fileeditor';
import { NotebookAdapter } from '@jupyterlab/notebook';
import { IFeatureSettings } from '../feature';
import { CodeMirrorVirtualEditor } from '../virtual/codemirror_editor';
import { VirtualDocument } from '../virtual/document';

import {
  CodeMirrorIntegration,
  CodeMirrorIntegrationConstructor
} from './codemirror';
import { EditorAdapter } from './editor_adapter';

import createNotebookPanel = NBTestUtils.createNotebookPanel;
import IEditor = CodeEditor.IEditor;

const DEFAULT_SERVER_ID = 'pylsp';

export interface ITestEnvironment {
  document_options: VirtualDocument.IOptions;

  virtual_editor: CodeMirrorVirtualEditor;

  adapter: WidgetLSPAdapter<any>;
  init(): void;

  dispose(): void;
}

export class MockLanguageServerManager extends LanguageServerManager {
  async fetchSessions() {
    // @ts-ignore
    this._sessions = new Map();
    // @ts-ignore
    this._sessions.set(DEFAULT_SERVER_ID, {
      spec: {
        languages: ['python']
      }
    } as any);
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

export abstract class TestEnvironment implements ITestEnvironment {
  virtual_editor: CodeMirrorVirtualEditor;
  adapter: WidgetLSPAdapter<any>;
  abstract widget: IDocumentWidget;
  protected abstract get_defaults(): VirtualDocument.IOptions;
  public document_options: VirtualDocument.IOptions;

  constructor(options?: Partial<VirtualDocument.IOptions>) {
    this.document_options = {
      ...this.get_defaults(),
      ...(options || {})
    };
    this.init();
  }

  protected abstract create_widget(): IDocumentWidget;

  init() {
    this.widget = this.create_widget();
    let adapter_type = this.get_adapter_type();
    this.adapter = new adapter_type(this.extension, this.widget);
    this.virtual_editor = this.create_virtual_editor();
    // override the virtual editor with a mock/test one
    this.adapter.virtual_editor = this.virtual_editor;
    this.adapter.initialized
      .then(() => {
        // override it again after initialization
        // TODO: rewrite tests to async to only override after initialization
        this.adapter.virtual_editor = this.virtual_editor;
      })
      .catch(console.error);
  }

  create_virtual_editor(): CodeMirrorVirtualEditor {
    return new CodeMirrorVirtualEditor({
      adapter: this.adapter,
      virtualDocument: new VirtualDocument(this.document_options)
    });
  }

  dispose(): void {
    this.adapter.dispose();
  }
}

export interface IFeatureTestEnvironment extends ITestEnvironment {
  init_integration<T extends CodeMirrorIntegration>(
    options: IFeatureTestEnvironment.IInitOptions
  ): T;

  dispose_feature(feature: CodeMirrorIntegration): void;
}

export namespace IFeatureTestEnvironment {
  export interface IInitOptions {
    constructor: CodeMirrorIntegrationConstructor;
    id: string;
    register?: boolean;
    document?: VirtualDocument;
    settings?: IFeatureSettings<any>;
  }
}

type TestEnvironmentConstructor = new (...args: any[]) => ITestEnvironment;

function FeatureSupport<TBase extends TestEnvironmentConstructor>(Base: TBase) {
  return class FeatureTestEnvironment
    extends Base
    implements IFeatureTestEnvironment
  {
    _connections: Map<CodeMirrorIntegration, ILSPConnection>;

    init() {
      this._connections = new Map();
      super.init();
    }

    get status_message() {
      return this.adapter.status_message;
    }

    public init_integration<T extends CodeMirrorIntegration>(
      options: IFeatureTestEnvironment.IInitOptions
    ): T {
      let connection = this.create_dummy_connection();
      let document = options.document
        ? options.document
        : this.virtual_editor.virtualDocument;

      let editor_adapter = this.adapter.connect_adapter(document, connection, [
        {
          id: options.id,
          name: options.id,
          editorIntegrationFactory: new Map([
            ['CodeMirrorEditor', options.constructor]
          ]),
          settings: options.settings
        }
      ]);
      this.virtual_editor.virtualDocument = document;
      document.changed.connect(async () => {
        await editor_adapter.updateAfterChange();
      });

      let feature = editor_adapter.features.get(options.id);
      this._connections.set(feature as CodeMirrorIntegration, connection);
      return feature as T;
    }

    public dispose_feature(feature: CodeMirrorIntegration) {
      let connection = this._connections.get(feature)!;
      connection.close();
      feature.is_registered = false;
    }

    public create_dummy_connection() {
      return new LSPConnection({
        languageId: this.document_options.language,
        serverUri: 'ws://localhost:8080',
        rootUri: 'file:///unit-test',
        serverIdentifier: DEFAULT_SERVER_ID,
        capabilities: {}
      });
    }

    public dispose() {
      super.dispose();
      for (let connection of this._connections.values()) {
        connection.close();
      }
    }
  };
}

export class FileEditorTestEnvironment extends TestEnvironment {
  protected get_adapter_type() {
    return FileEditorAdapter;
  }
  widget: IDocumentWidget<FileEditor>;

  protected get_defaults(): VirtualDocument.IOptions {
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

  get ceEditor(): CodeMirrorEditor {
    return this.widget.content.editor as CodeMirrorEditor;
  }

  create_widget(): IDocumentWidget {
    let factory = new FileEditorFactory({
      editorServices: {
        factoryService: new CodeMirrorEditorFactory(),
        mimeTypeService: new CodeMirrorMimeTypeService()
      },
      factoryOptions: {
        name: 'Editor',
        fileTypes: ['*']
      }
    });
    const context = new Context({
      manager: new ServiceManagerMock(),
      factory: new TextModelFactory(),
      path: this.document_options.path
    });
    return factory.createNew(context);
  }

  dispose(): void {
    super.dispose();
    this.ceEditor.dispose();
  }
}

export class NotebookTestEnvironment extends TestEnvironment {
  public widget: NotebookPanel;
  protected get_adapter_type() {
    return NotebookAdapter;
  }

  get notebook(): Notebook {
    return this.widget.content;
  }

  protected get_defaults(): VirtualDocument.IOptions {
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

  create_widget(): IDocumentWidget {
    let context = new Context({
      manager: new ServiceManager({ standby: 'never' }),
      factory: new NotebookModelFactory({}),
      path: this.document_options.path
    });
    return createNotebookPanel(context);
  }
}

export class FileEditorFeatureTestEnvironment extends FeatureSupport(
  FileEditorTestEnvironment
) {}
export class NotebookFeatureTestEnvironment extends FeatureSupport(
  NotebookTestEnvironment
) {}

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
  environment: IFeatureTestEnvironment,
  adapter: EditorAdapter<IVirtualEditor<IEditor>>
) {
  await environment.adapter.updateDocuments();
  try {
    await adapter.updateAfterChange();
  } catch (e) {
    console.warn(e);
  }
}
*/
