import { VirtualDocument, IForeignContext } from './virtual/document';

import { Signal } from '@lumino/signaling';
import { URLExt } from '@jupyterlab/coreutils';
import { sleep, until_ready } from './utils';

import {
  ILSPConnection,
} from './tokens';
import { CommLSPConnection } from './comm/connection';
import { expandDottedPaths } from './utils';

import {
  TLanguageServerId,
  ILanguageServerManager,
  ILanguageServerConfiguration,
  TLanguageServerConfigurations
} from './tokens';

export interface IDocumentConnectionData {
  virtual_document: VirtualDocument;
  connection: ILSPConnection;
}

export interface ISocketConnectionOptions {
  virtual_document: VirtualDocument;
  /**
   * The language identifier, corresponding to the API endpoint on the LSP proxy server.
   */
  language: string;
  /**
   * Path to the document in the JupyterLab space
   */
  document_path: string;
}

/**
 * Each Widget with a document (whether file or a notebook) has its own DocumentConnectionManager
 * (see JupyterLabWidgetAdapter), keeping the virtual document spaces separate if a file is opened twice.
 */
export class DocumentConnectionManager {
  connections: Map<VirtualDocument.id_path, ILSPConnection>;
  documents: Map<VirtualDocument.id_path, VirtualDocument>;
  initialized: Signal<DocumentConnectionManager, IDocumentConnectionData>;
  connected: Signal<DocumentConnectionManager, IDocumentConnectionData>;
  /**
   * Connection temporarily lost or could not be fully established; a re-connection will be attempted;
   */
  disconnected: Signal<DocumentConnectionManager, IDocumentConnectionData>;
  /**
   * Connection was closed permanently and no-reconnection will be attempted, e.g.:
   *  - there was a serious server error
   *  - user closed the connection,
   *  - re-connection attempts exceeded,
   */
  closed: Signal<DocumentConnectionManager, IDocumentConnectionData>;
  documents_changed: Signal<
    DocumentConnectionManager,
    Map<VirtualDocument.id_path, VirtualDocument>
  >;
  language_server_manager: ILanguageServerManager;
  initial_configurations: TLanguageServerConfigurations;
  private ignored_languages: Set<string>;

  constructor(options: DocumentConnectionManager.IOptions) {
    this.connections = new Map();
    this.documents = new Map();
    this.ignored_languages = new Set();
    this.connected = new Signal(this);
    this.initialized = new Signal(this);
    this.disconnected = new Signal(this);
    this.closed = new Signal(this);
    this.documents_changed = new Signal(this);
    this.language_server_manager = options.language_server_manager;
    Private.setLanguageServerManager(options.language_server_manager);
  }

  connect_document_signals(virtual_document: VirtualDocument) {
    virtual_document.foreign_document_opened.connect(
      this.on_foreign_document_opened,
      this
    );

    virtual_document.foreign_document_closed.connect(
      this.on_foreign_document_closed,
      this
    );

    this.documents.set(virtual_document.id_path, virtual_document);
    this.documents_changed.emit(this.documents);
  }

  disconnect_document_signals(virtual_document: VirtualDocument, emit = true) {
    virtual_document.foreign_document_opened.disconnect(
      this.on_foreign_document_opened,
      this
    );

    virtual_document.foreign_document_closed.disconnect(
      this.on_foreign_document_closed,
      this
    );

    this.documents.delete(virtual_document.id_path);
    for (const foreign of virtual_document.foreign_documents.values()) {
      this.disconnect_document_signals(foreign, false);
    }

    if (emit) {
      this.documents_changed.emit(this.documents);
    }
  }

  on_foreign_document_opened(_host: VirtualDocument, context: IForeignContext) {
    console.log(
      'LSP: ConnectionManager received foreign document: ',
      context.foreign_document.id_path
    );
  }

  on_foreign_document_closed(_host: VirtualDocument, context: IForeignContext) {
    const { foreign_document } = context;
    this.disconnect_document_signals(foreign_document);
  }

  private async connect_socket(
    options: ISocketConnectionOptions
  ): Promise<ILSPConnection> {
    console.log('LSP: Connection Socket', options);
    let { virtual_document, language } = options;

    this.connect_document_signals(virtual_document);

    const uris = DocumentConnectionManager.solve_uris(
      virtual_document,
      language
    );

    const language_server_id = await this.language_server_manager.getServerId({
      language,
    });

    // lazily load 1) the underlying library (1.5mb) and/or 2) a live WebSocket-
    // like connection: either already connected or potentiailly in the process
    // of connecting.
    const connection = await Private.connection(
      language,
      language_server_id,
      uris,
      this.on_new_connection
    );

    // if connecting for the first time, all documents subsequent documents will
    // be re-opened and synced
    this.connections.set(virtual_document.id_path, connection);

    return connection;
  }

  /**
   * Currently only supports the settings that the language servers
   * accept using onDidChangeConfiguration messages, under the
   * "serverSettings" keyword in the setting registry. New keywords can
   * be added and extra functionality implemented here when needed.
   */
  public updateServerConfigurations(allServerSettings: any) {
    for (let language_server_id in allServerSettings) {
      const parsedSettings = expandDottedPaths(
        allServerSettings[language_server_id].serverSettings
      );

      const serverSettings: ILanguageServerConfiguration = {
        settings: parsedSettings
      };

      Private.updateServerConfiguration(language_server_id, serverSettings);
    }
  }

  /**
   * Fired the first time a connection is opened. These _should_ be the only
   * invocation of `.on` (once remaining LSPFeature.connection_handlers are made
   * singletons).
   */
  on_new_connection = (connection: ILSPConnection) => {
    // nb: investigate failure modes
    // connection.on('error', e => {
    //   console.warn(e);
    //   // TODO invalid now
    //   let error: Error = e.length && e.length >= 1 ? e[0] : new Error();
    //   // TODO: those codes may be specific to my proxy client, need to investigate
    //   if (error.message.indexOf('code = 1005') !== -1) {
    //     console.warn(`LSP: Connection failed for ${connection}`);
    //     this.forEachDocumentOfConnection(connection, virtual_document => {
    //       console.warn('LSP: disconnecting ' + virtual_document.id_path);
    //       this.closed.emit({ connection, virtual_document });
    //       this.ignored_languages.add(virtual_document.language);

    //       console.warn(
    //         `Cancelling further attempts to connect ${virtual_document.id_path} and other documents for this language (no support from the server)`
    //       );
    //     });
    //   } else if (error.message.indexOf('code = 1006') !== -1) {
    //     console.warn('LSP: Connection closed by the server ');
    //   } else {
    //     console.error('LSP: Connection error:', e);
    //   }
    // });

    connection.on('serverInitialized', (capabilities) => {
      this.forEachDocumentOfConnection(connection, (virtual_document) => {
        // TODO: is this still neccessary, e.g. for status bar to update responsively?
        this.initialized.emit({ connection, virtual_document });
      });

      // Initialize using settings stored in the SettingRegistry
      this.updateServerConfigurations(this.initial_configurations);
    });

    connection.on('close', (closed_manually) => {
      if (!closed_manually) {
        console.warn('LSP: Connection unexpectedly disconnected');
      } else {
        console.warn('LSP: Connection closed');
        this.forEachDocumentOfConnection(connection, (virtual_document) => {
          this.closed.emit({ connection, virtual_document });
        });
      }
    });
  };

  private forEachDocumentOfConnection(
    connection: ILSPConnection,
    callback: (virtual_document: VirtualDocument) => void
  ) {
    for (const [
      virtual_document_id_path,
      a_connection,
    ] of this.connections.entries()) {
      if (connection !== a_connection) {
        continue;
      }
      callback(this.documents.get(virtual_document_id_path));
    }
  }

  /**
   * TODO: presently no longer referenced. A failing connection would close
   * the socket, triggering the language server on the other end to exit
   */
  public async retry_to_connect(
    options: ISocketConnectionOptions,
    reconnect_delay: number,
    retrials_left = -1
  ) {
    let { virtual_document } = options;

    if (this.ignored_languages.has(virtual_document.language)) {
      return;
    }

    let interval = reconnect_delay * 1000;
    let success = false;

    while (retrials_left !== 0 && !success) {
      await this.connect(options)
        .then(() => {
          success = true;
        })
        .catch((e) => {
          console.warn(e);
        });

      console.log(
        'LSP: will attempt to re-connect in ' + interval / 1000 + ' seconds'
      );
      await sleep(interval);

      // gradually increase the time delay, up to 5 sec
      interval = interval < 5 * 1000 ? interval + 500 : interval;
    }
  }

  async connect(options: ISocketConnectionOptions) {
    console.log('LSP: connection requested', options);
    let connection = await this.connect_socket(options);

    let { virtual_document, document_path } = options;

    if (!connection.isReady) {
      try {
        await until_ready(() => connection.isReady, 200, 200);
      } catch {
        console.warn(`LSP: Connect timed out for ${virtual_document.id_path}`);
        return;
      }
    }

    console.log('LSP:', document_path, virtual_document.id_path, 'connected.');

    this.connected.emit({ connection, virtual_document });

    return connection;
  }

  public unregister_document(virtual_document: VirtualDocument) {
    this.connections.delete(virtual_document.id_path);
    this.documents_changed.emit(this.documents);
  }
}

export namespace DocumentConnectionManager {
  export interface IOptions {
    language_server_manager: ILanguageServerManager;
  }

  export function solve_uris(
    virtual_document: VirtualDocument,
    language: string
  ): IURIs {
    const manager = Private.getLanguageServerManager();
    const rootUri = manager.getRootUri();
    const virtualDocumentsUri = manager.getVirtualDocumentsUri();

    const baseUri = virtual_document.has_lsp_supported_file
      ? rootUri
      : virtualDocumentsUri;

    return {
      base: baseUri,
      document: URLExt.join(baseUri, virtual_document.uri),
    };
  }

  export interface IURIs {
    base: string;
    document: string;
  }
}

/**
 * Namespace primarily for language-keyed cache of `ILSPConnection`s
 */
namespace Private {
  const _connections: Map<TLanguageServerId, ILSPConnection> = new Map();
  let _language_server_manager: ILanguageServerManager;

  export function getLanguageServerManager() {
    return _language_server_manager;
  }
  export function setLanguageServerManager(
    language_server_manager: ILanguageServerManager
  ) {
    _language_server_manager = language_server_manager;
  }

  /**
   * Return (or create and initialize) the WebSocket associated with the language
   */
  export async function connection(
    language: string,
    language_server_id: TLanguageServerId,
    uris: DocumentConnectionManager.IURIs,
    onCreate: (connection: ILSPConnection) => void
  ): Promise<ILSPConnection> {
    let connection = _connections.get(language_server_id);

    if (connection == null) {
      const comm = await _language_server_manager.getComm(language_server_id);
      const connection = new CommLSPConnection({ comm, rootUri: uris.base });
      connection.commDisposed.connect(async (connection: CommLSPConnection) => {
        connection.comm = await _language_server_manager.getComm(
          language_server_id
        );
        await connection.connect();
      });
      _connections.set(language_server_id, connection);
      await connection.connect();
      onCreate(connection);
    }

    connection = _connections.get(language_server_id);

    return connection;
  }

  export function updateServerConfiguration(
    language_server_id: TLanguageServerId,
    settings: ILanguageServerConfiguration
  ): void {
    const connection = _connections.get(language_server_id);
    if (connection) {
      connection.sendConfigurationChange(settings);
    }
  }
}
