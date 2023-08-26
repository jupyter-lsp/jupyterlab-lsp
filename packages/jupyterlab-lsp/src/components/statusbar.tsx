// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
// Based on the @jupyterlab/codemirror-extension statusbar

import { JupyterFrontEnd } from '@jupyterlab/application';
import {
  VDomModel,
  VDomRenderer,
  Dialog,
  showDialog
} from '@jupyterlab/apputils';
import { DocumentRegistry, IDocumentWidget } from '@jupyterlab/docregistry';
import {
  ILSPConnection,
  collectDocuments,
  ILSPDocumentConnectionManager,
  VirtualDocument,
  WidgetLSPAdapter,
  ILanguageServerManager
} from '@jupyterlab/lsp';
import { INotebookModel, NotebookPanel } from '@jupyterlab/notebook';
import { GroupItem, Popup, TextItem, showPopup } from '@jupyterlab/statusbar';
import { TranslationBundle } from '@jupyterlab/translation';
import {
  LabIcon,
  caretDownIcon,
  caretUpIcon,
  circleEmptyIcon,
  circleIcon,
  stopIcon
} from '@jupyterlab/ui-components';
import React from 'react';

import '../../style/statusbar.css';
import * as SCHEMA from '../_schema';
import { SERVER_EXTENSION_404 } from '../errors';
import { TSessionMap, TLanguageServerId, TSpecsMap } from '../tokens';

import { codeCheckIcon, codeClockIcon, codeWarningIcon } from './icons';
import { DocumentLocator, ServerLinksList } from './utils';

import okButton = Dialog.okButton;

interface IServerStatusProps {
  server: SCHEMA.LanguageServerSession;
}

function ServerStatus(props: IServerStatusProps) {
  let list = props.server.spec.languages!.map((language, i) => (
    <li key={i}>{language}</li>
  ));
  return (
    <div className={'lsp-server-status'}>
      <h5>{props.server.spec.display_name}</h5>
      <ul>{list}</ul>
    </div>
  );
}

export interface IListProps {
  /**
   * A title to display.
   */
  title: string;
  list: any[];
  /**
   * By default the list will be expanded; to change the initial state to collapsed, set to true.
   */
  startCollapsed?: boolean;
}

export interface ICollapsibleListStates {
  isCollapsed: boolean;
}

class CollapsibleList extends React.Component<
  IListProps,
  ICollapsibleListStates
> {
  constructor(props: IListProps) {
    super(props);
    this.state = { isCollapsed: props.startCollapsed || false };
  }

  handleClick = () => {
    this.setState(state => ({
      isCollapsed: !state.isCollapsed
    }));
  };

  render() {
    const collapseExpandIcon = !this.state.isCollapsed
      ? caretUpIcon
      : caretDownIcon;
    return (
      <div
        className={
          'lsp-collapsible-list ' +
          (this.state.isCollapsed ? 'lsp-collapsed' : '')
        }
      >
        <h4 onClick={this.handleClick}>
          <collapseExpandIcon.react tag="span" className="lsp-caret-icon" />
          {this.props.title}: {this.props.list.length}
        </h4>
        <div>{this.props.list}</div>
      </div>
    );
  }
}

interface IHelpButtonProps {
  language: string;
  servers: TSpecsMap;
  trans: TranslationBundle;
}

interface ILanguageServerInfo {
  serverId: TLanguageServerId;
  specs: SCHEMA.LanguageServerSpec;
  trans: TranslationBundle;
}

class LanguageServerInfo extends React.Component<ILanguageServerInfo, any> {
  render() {
    const specification = this.props.specs;
    const trans = this.props.trans;
    return (
      <div>
        <h3>{specification.display_name}</h3>
        <div>
          <ServerLinksList specification={specification} />
          <h4>{trans.__('Troubleshooting')}</h4>
          <p className={'lsp-troubleshoot-section'}>
            {specification.troubleshoot
              ? specification.troubleshoot
              : trans.__(
                  'In case of issues with installation feel welcome to ask a question on GitHub.'
                )}
          </p>
          <h4>{trans.__('Installation')}</h4>
          <ul>
            {specification?.install
              ? Object.entries(specification?.install || {}).map(
                  ([name, command]) => (
                    <li key={this.props.serverId + '-install-' + name}>
                      {name}: <code>{command}</code>
                    </li>
                  )
                )
              : trans.__(
                  'No installation instructions were provided with this specification.'
                )}
          </ul>
        </div>
      </div>
    );
  }
}

class HelpButton extends React.Component<IHelpButtonProps, any> {
  handleClick = () => {
    const trans = this.props.trans;

    showDialog({
      title: trans.__(
        'No language server for %1 detected',
        this.props.language
      ),
      body: (
        <div>
          {this.props.servers.size ? (
            <div>
              <p>
                {trans._n(
                  'There is %1 language server you can easily install that supports %2.',
                  'There are %1 language servers you can easily install that supports %2.',
                  this.props.servers.size,
                  this.props.language
                )}
              </p>
              {[...this.props.servers.entries()].map(([key, specification]) => (
                <LanguageServerInfo
                  specs={specification}
                  serverId={key}
                  key={key}
                  trans={trans}
                />
              ))}
            </div>
          ) : (
            <div>
              <p>
                {trans.__(
                  'We do not have an auto-detection ready for a language servers supporting %1 yet.',
                  this.props.language
                )}
              </p>
              <p>
                {trans.__(
                  'You may contribute a specification for auto-detection as described in our '
                )}{' '}
                <a
                  href={
                    'https://jupyterlab-lsp.readthedocs.io/en/latest/Contributing.html#specs'
                  }
                >
                  {trans.__('documentation')}
                </a>
              </p>
            </div>
          )}
        </div>
      ),
      buttons: [okButton()]
    }).catch(console.warn);
  };

  render() {
    return (
      <button
        type={'button'}
        className={'jp-Button lsp-help-button'}
        onClick={this.handleClick}
      >
        ?
      </button>
    );
  }
}

class LSPPopup extends VDomRenderer<LSPStatus.Model> {
  constructor(model: LSPStatus.Model) {
    super(model);
    this.addClass('lsp-popover');
  }
  render() {
    if (!this.model?.connectionManager) {
      return null;
    }
    const serversAvailable = this.model.serversAvailableNotInUse.map(
      (session, i) => <ServerStatus key={i} server={session} />
    );

    let runningServers = new Array<any>();
    let key = -1;
    for (let [
      session,
      documentsByLanguage
    ] of this.model.documentsByServer.entries()) {
      key += 1;
      let documentsHtml = new Array<any>();
      for (let [language, documents] of documentsByLanguage) {
        // TODO: stop button
        // TODO: add a config buttons next to the language header
        let list = documents.map((document, i) => {
          let connection = this.model.connectionManager.connections.get(
            document.uri
          );

          let status = '';
          if (connection?.isInitialized) {
            status = 'initialized';
          } else if (connection?.isConnected) {
            status = 'connected';
          } else {
            status = 'not connected';
          }

          const icon = status === 'initialized' ? circleIcon : circleEmptyIcon;

          return (
            <li key={i}>
              <DocumentLocator
                document={document}
                adapter={this.model.adapter!}
              />
              <span className={'lsp-document-status'}>
                {this.model.trans.__(status)}
                <icon.react
                  tag="span"
                  className="lsp-document-status-icon"
                  elementSize={'small'}
                />
              </span>
            </li>
          );
        });

        documentsHtml.push(
          <div key={key} className={'lsp-documents-by-language'}>
            <h5>
              {language}{' '}
              <span className={'lsp-language-server-name'}>
                ({session.spec.display_name})
              </span>
            </h5>
            <ul>{list}</ul>
          </div>
        );
      }

      runningServers.push(<div key={key}>{documentsHtml}</div>);
    }

    const missingLanguages = this.model.missingLanguages.map((language, i) => {
      const specsForMissing = this.model.languageServerManager.getMatchingSpecs(
        { language }
      );
      return (
        <div key={i} className={'lsp-missing-server'}>
          {language}
          {specsForMissing.size ? (
            <HelpButton
              language={language}
              servers={specsForMissing}
              trans={this.model.trans}
            />
          ) : (
            ''
          )}
        </div>
      );
    });
    const trans = this.model.trans;
    return (
      <div className={'lsp-popover-content'}>
        <div className={'lsp-servers-menu'}>
          <h3 className={'lsp-servers-title'}>{trans.__('LSP servers')}</h3>
          <div className={'lsp-servers-lists'}>
            {serversAvailable.length ? (
              <CollapsibleList
                key={'available'}
                title={trans.__('Available')}
                list={serversAvailable}
                startCollapsed={true}
              />
            ) : (
              ''
            )}
            {runningServers.length ? (
              <CollapsibleList
                key={'running'}
                title={trans.__('Running')}
                list={runningServers}
              />
            ) : (
              ''
            )}
            {missingLanguages.length ? (
              <CollapsibleList
                key={'missing'}
                title={trans.__('Missing')}
                list={missingLanguages}
              />
            ) : (
              ''
            )}
          </div>
        </div>
        <div className={'lsp-popover-status'}>
          {trans.__('Documentation:')}{' '}
          <a
            href={
              'https://jupyterlab-lsp.readthedocs.io/en/latest/Language%20Servers.html'
            }
            target="_blank"
            rel="noreferrer"
          >
            {trans.__('Language Servers')}
          </a>
        </div>
      </div>
    );
  }
}

/**
 * StatusBar item.
 */
export class LSPStatus extends VDomRenderer<LSPStatus.Model> {
  protected _popup: Popup | null = null;
  private trans: TranslationBundle;
  /**
   * Construct a new VDomRenderer for the status item.
   */
  constructor(
    protected displayText: boolean = true,
    shell: JupyterFrontEnd.IShell,
    trans: TranslationBundle
  ) {
    super(new LSPStatus.Model(shell, trans));
    this.addClass('jp-mod-highlighted');
    this.addClass('lsp-statusbar-item');
    this.trans = trans;
    this.title.caption = this.trans.__('LSP status');
  }

  /**
   * Render the status item.
   */
  render() {
    const { model } = this;

    if (model == null) {
      return null;
    }

    return (
      <GroupItem
        spacing={this.displayText ? 2 : 0}
        title={model.longMessage}
        onClick={this.handleClick}
        className={'lsp-status-group'}
      >
        <model.statusIcon.react
          top={'2px'}
          stylesheet={'statusBar'}
          title={this.trans.__('LSP Code Intelligence')}
        />
        {this.displayText ? (
          <TextItem
            className={'lsp-status-message'}
            source={model.shortMessage}
          />
        ) : (
          <></>
        )}
      </GroupItem>
    );
  }

  handleClick = () => {
    if (this._popup) {
      this._popup.dispose();
    }
    if (this.model.status.status == 'noServerExtension') {
      showDialog({
        title: this.trans.__('LSP server extension not found'),
        body: SERVER_EXTENSION_404,
        buttons: [okButton()]
      }).catch(console.warn);
    } else {
      this._popup = showPopup({
        body: new LSPPopup(this.model),
        anchor: this,
        align: 'left',
        hasDynamicSize: true
      });
    }
  };
}

export class StatusButtonExtension
  implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel>
{
  constructor(
    private options: {
      languageServerManager: ILanguageServerManager;
      connectionManager: ILSPDocumentConnectionManager;
      shell: JupyterFrontEnd.IShell;
      translatorBundle: TranslationBundle;
    }
  ) {}

  /**
   * For statusbar registration and for internal use.
   */
  createItem(displayText: boolean = true): LSPStatus {
    const statusBarItem = new LSPStatus(
      displayText,
      this.options.shell,
      this.options.translatorBundle
    );
    statusBarItem.model.languageServerManager =
      this.options.languageServerManager;
    statusBarItem.model.connectionManager = this.options.connectionManager;
    return statusBarItem;
  }

  /**
   * For registration on notebook panels.
   */
  createNew(
    panel: NotebookPanel,
    context: DocumentRegistry.IContext<INotebookModel>
  ): LSPStatus {
    const item = this.createItem(false);
    item.addClass('jp-ToolbarButton');
    panel.toolbar.insertAfter('spacer', 'LSPStatus', item);

    return item;
  }
}

type StatusCode =
  | 'noServerExtension'
  | 'waiting'
  | 'initializing'
  | 'initialized'
  | 'connecting'
  | 'initializedButSomeMissing';

export interface IStatus {
  connectedDocuments: Set<VirtualDocument>;
  initializedDocuments: Set<VirtualDocument>;
  openConnections: Array<ILSPConnection>;
  detectedDocuments: Set<VirtualDocument>;
  status: StatusCode;
}

function collectLanguages(virtualDocument: VirtualDocument): Set<string> {
  let documents = collectDocuments(virtualDocument);
  return new Set(
    [...documents].map(document => document.language.toLocaleLowerCase())
  );
}

type StatusMap = Record<StatusCode, string>;
type StatusIconClass = Record<StatusCode, string>;

const classByStatus: StatusIconClass = {
  noServerExtension: 'error',
  waiting: 'inactive',
  initialized: 'ready',
  initializing: 'preparing',
  initializedButSomeMissing: 'ready',
  connecting: 'preparing'
};

const iconByStatus: Record<StatusCode, LabIcon> = {
  noServerExtension: codeWarningIcon,
  waiting: codeClockIcon,
  initialized: codeCheckIcon,
  initializing: codeClockIcon,
  initializedButSomeMissing: codeWarningIcon,
  connecting: codeClockIcon
};

export namespace LSPStatus {
  /**
   * A VDomModel for the LSP of current file editor/notebook.
   */
  export class Model extends VDomModel {
    languageServerManager: ILanguageServerManager;
    trans: TranslationBundle;
    private _connectionManager: ILSPDocumentConnectionManager;
    private _shortMessageByStatus: StatusMap;

    constructor(
      private _shell: JupyterFrontEnd.IShell,
      trans: TranslationBundle
    ) {
      super();
      this.trans = trans;
      this._shortMessageByStatus = {
        noServerExtension: trans.__('Server extension missing'),
        waiting: trans.__('Waiting…'),
        initialized: trans.__('Fully initialized'),
        initializedButSomeMissing: trans.__(
          'Initialized (additional servers needed)'
        ),
        initializing: trans.__('Initializing…'),
        connecting: trans.__('Connecting…')
      };
    }

    get availableServers(): TSessionMap {
      return this.languageServerManager.sessions;
    }

    get supportedLanguages(): Set<string> {
      const languages = new Set<string>();
      for (let server of this.availableServers.values()) {
        for (let language of server.spec.languages!) {
          languages.add(language.toLocaleLowerCase());
        }
      }
      return languages;
    }

    private _isServerRunning(
      id: TLanguageServerId,
      server: SCHEMA.LanguageServerSession
    ): boolean {
      for (const language of this.detectedLanguages) {
        const matchedServers = this.languageServerManager.getMatchingServers({
          language
        });
        // TODO server.status === "started" ?
        // TODO update once multiple servers are allowed
        if (matchedServers.length && matchedServers[0] === id) {
          return true;
        }
      }
      return false;
    }

    get documentsByServer(): Map<
      SCHEMA.LanguageServerSession,
      Map<string, VirtualDocument[]>
    > {
      let data = new Map<
        SCHEMA.LanguageServerSession,
        Map<string, VirtualDocument[]>
      >();
      if (!this.adapter?.virtualDocument) {
        return data;
      }

      let mainDocument = this.adapter.virtualDocument;
      let documents = collectDocuments(mainDocument);

      for (let document of documents.values()) {
        let language = document.language.toLocaleLowerCase();
        let serverIds =
          this._connectionManager.languageServerManager.getMatchingServers({
            language: document.language
          });
        if (serverIds.length === 0) {
          continue;
        }
        // For now only use the server with the highest priority
        let server = this.languageServerManager.sessions.get(serverIds[0])!;

        if (!data.has(server)) {
          data.set(server, new Map<string, VirtualDocument[]>());
        }

        let documentsMap = data.get(server)!;

        if (!documentsMap.has(language)) {
          documentsMap.set(language, new Array<VirtualDocument>());
        }

        let documents = documentsMap.get(language)!;
        documents.push(document);
      }
      return data;
    }

    get serversAvailableNotInUse(): Array<SCHEMA.LanguageServerSession> {
      return [...this.availableServers.entries()]
        .filter(([id, server]) => !this._isServerRunning(id, server))
        .map(([id, server]) => server);
    }

    get detectedLanguages(): Set<string> {
      if (!this.adapter?.virtualDocument) {
        return new Set<string>();
      }

      let document = this.adapter.virtualDocument;
      return collectLanguages(document);
    }

    get missingLanguages(): Array<string> {
      // TODO: false negative for r vs R?
      return [...this.detectedLanguages].filter(
        language => !this.supportedLanguages.has(language.toLocaleLowerCase())
      );
    }

    get status(): IStatus {
      let detectedDocuments: Map<string, VirtualDocument>;

      if (!this.adapter?.virtualDocument) {
        detectedDocuments = new Map();
      } else {
        let mainDocument = this.adapter.virtualDocument;
        const allDocuments = this._connectionManager.documents;
        // detected documents that are open in the current virtual editor
        const detectedDocumentsSet = collectDocuments(mainDocument);
        detectedDocuments = new Map(
          [...allDocuments].filter(([id, doc]) => detectedDocumentsSet.has(doc))
        );
      }

      let connectedDocuments = new Set<VirtualDocument>();
      let initializedDocuments = new Set<VirtualDocument>();
      let absentDocuments = new Set<VirtualDocument>();
      // detected documents with LSP servers available
      let documentsWithAvailableServers = new Set<VirtualDocument>();
      // detected documents with LSP servers known
      let documentsWithKnownServers = new Set<VirtualDocument>();

      detectedDocuments.forEach((document, uri) => {
        let connection = this._connectionManager.connections.get(uri);
        let serverIds =
          this._connectionManager.languageServerManager.getMatchingServers({
            language: document.language
          });

        if (serverIds.length !== 0) {
          documentsWithKnownServers.add(document);
        }
        if (!connection) {
          absentDocuments.add(document);
          return;
        } else {
          documentsWithAvailableServers.add(document);
        }

        if (connection.isConnected) {
          connectedDocuments.add(document);
        }
        if (connection.isInitialized) {
          initializedDocuments.add(document);
        }
      });

      // there may be more open connections than documents if a document was recently closed
      // and the grace period has not passed yet
      let openConnections = new Array<ILSPConnection>();
      this._connectionManager.connections.forEach((connection, path) => {
        if (connection.isConnected) {
          openConnections.push(connection);
        }
      });

      let status: StatusCode;
      if (this.languageServerManager.statusCode === 404) {
        status = 'noServerExtension';
      } else if (detectedDocuments.size === 0) {
        status = 'waiting';
      } else if (initializedDocuments.size === detectedDocuments.size) {
        status = 'initialized';
      } else if (
        initializedDocuments.size === documentsWithAvailableServers.size &&
        detectedDocuments.size > documentsWithKnownServers.size
      ) {
        status = 'initializedButSomeMissing';
      } else if (
        connectedDocuments.size === documentsWithAvailableServers.size
      ) {
        status = 'initializing';
      } else {
        status = 'connecting';
      }

      return {
        openConnections,
        connectedDocuments,
        initializedDocuments,
        detectedDocuments: new Set([...detectedDocuments.values()]),
        status
      };
    }

    get statusIcon(): LabIcon {
      if (!this.adapter) {
        return stopIcon;
      }
      return iconByStatus[this.status.status].bindprops({
        className: 'lsp-status-icon ' + classByStatus[this.status.status]
      });
    }

    get shortMessage(): string {
      if (!this.adapter) {
        return this.trans.__('Not initialized');
      }
      return this._shortMessageByStatus[this.status.status];
    }

    get longMessage(): string {
      if (!this.adapter) {
        return this.trans.__('not initialized');
      }
      let status = this.status;
      let msg = '';
      if (status.status === 'waiting') {
        msg = this.trans.__('Waiting for documents initialization...');
      } else if (status.status === 'initialized') {
        msg = this.trans._n(
          'Fully connected & initialized (%2 virtual document)',
          'Fully connected & initialized (%2 virtual document)',
          status.detectedDocuments.size,
          status.detectedDocuments.size
        );
      } else if (status.status === 'initializing') {
        const uninitialized = new Set<VirtualDocument>(
          status.detectedDocuments
        );
        for (let initialized of status.initializedDocuments.values()) {
          uninitialized.delete(initialized);
        }
        // servers for n documents did not respond to the initialization request
        msg = this.trans._np(
          'pluralized',
          'Fully connected, but %2/%3 virtual document stuck uninitialized: %4',
          'Fully connected, but %2/%3 virtual documents stuck uninitialized: %4',
          status.detectedDocuments.size,
          uninitialized.size,
          status.detectedDocuments.size,
          [...uninitialized].map(document => document.idPath).join(', ')
        );
      } else {
        const unconnected = new Set<VirtualDocument>(status.detectedDocuments);
        for (let connected of status.connectedDocuments.values()) {
          unconnected.delete(connected);
        }

        msg = this.trans._np(
          'pluralized',
          '%2/%3 virtual document connected (%4 connections; waiting for: %5)',
          '%2/%3 virtual documents connected (%4 connections; waiting for: %5)',
          status.detectedDocuments.size,
          status.connectedDocuments.size,
          status.detectedDocuments.size,
          status.openConnections.length,
          [...unconnected].map(document => document.idPath).join(', ')
        );
      }
      return msg;
    }

    get adapter(): WidgetLSPAdapter<IDocumentWidget> | null {
      const adapter = [...this.connectionManager.adapters.values()].find(
        adapter => adapter.widget == this._shell.currentWidget
      );
      return adapter ?? null;
    }

    get connectionManager() {
      return this._connectionManager;
    }

    /**
     * Note: it is ever only set once, as connectionManager is a singleton.
     */
    set connectionManager(connectionManager) {
      if (this._connectionManager != null) {
        this._connectionManager.connected.disconnect(this._onChange);
        this._connectionManager.initialized.connect(this._onChange);
        this._connectionManager.disconnected.disconnect(this._onChange);
        this._connectionManager.closed.disconnect(this._onChange);
        this._connectionManager.documentsChanged.disconnect(this._onChange);
      }

      if (connectionManager != null) {
        connectionManager.connected.connect(this._onChange);
        connectionManager.initialized.connect(this._onChange);
        connectionManager.disconnected.connect(this._onChange);
        connectionManager.closed.connect(this._onChange);
        connectionManager.documentsChanged.connect(this._onChange);
      }

      this._connectionManager = connectionManager;
    }

    private _onChange = () => {
      this.stateChanged.emit(void 0);
    };
  }
}
