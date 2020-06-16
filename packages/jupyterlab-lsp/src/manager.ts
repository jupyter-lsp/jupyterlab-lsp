import { PromiseDelegate } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';

import {
  // ServerConnection,
  ServiceManager,
  KernelMessage
} from '@jupyterlab/services';

import {
  ILanguageServerManager,
  TSessionMap,
  TCommMap,
  TLanguageServerId
} from './tokens';
import * as SCHEMA from './_schema';
import { ISessionConnection } from '@jupyterlab/services/lib/session/session';
import { IComm } from '@jupyterlab/services/lib/kernel/kernel';

const COMM_TARGET = 'jupyter.lsp';

export class LanguageServerManager implements ILanguageServerManager {
  protected _sessionsChanged: Signal<ILanguageServerManager, void> = new Signal<
    ILanguageServerManager,
    void
  >(this);
  protected _sessions: TSessionMap = new Map();
  protected _controlComm: IComm;
  protected _comms: TCommMap = new Map();
  private _serviceManager: ServiceManager;
  private _kernelSessionConnection: ISessionConnection;
  private _kernelReady = new PromiseDelegate<void>();
  private _rootUri: string;
  private _virtualDocumentsUri: string;

  constructor(options: ILanguageServerManager.IOptions) {
    this._serviceManager = options.serviceManager;
    this.initKernel().catch(console.error);
  }

  get sessionsChanged() {
    return this._sessionsChanged;
  }

  get sessions(): TSessionMap {
    return this._sessions;
  }

  get ready() {
    return this._kernelReady.promise;
  }

  protected async ensureKernel() {
    if (this._kernelSessionConnection.kernel == null) {
      await this.initKernel();
      await this._kernelReady.promise;
    }
    return this._kernelSessionConnection.kernel;
  }

  async getComm(language_server_id: TLanguageServerId): Promise<IComm> {
    let comm = this._comms.get(language_server_id);

    if (comm?.isDisposed) {
      this._comms.delete(language_server_id);
      comm = null;
    }

    if (comm != null) {
      return comm;
    }

    // nb: check sessions first?
    comm = await this.getLanguageServerComm(language_server_id);
    this._comms.set(language_server_id, comm);
    return comm;
  }

  async getServerId(options: ILanguageServerManager.IGetServerIdOptions) {
    await this._kernelReady.promise;

    // most things speak language
    for (const [key, session] of this._sessions.entries()) {
      if (options.language) {
        if (session.spec.languages.indexOf(options.language) !== -1) {
          return key;
        }
      }
    }
    return null;
  }

  getRootUri() {
    return this._rootUri;
  }

  getVirtualDocumentsUri() {
    return this._virtualDocumentsUri;
  }

  /**
   * Register a new kernel
   */
  protected async _handleKernelChanged({
    oldValue,
    newValue
  }: ISessionConnection.IKernelChangedArgs): Promise<void> {
    if (this._controlComm) {
      this._controlComm = null;
    }

    if (newValue == null) {
      return;
    }

    this._controlComm = await this.getControlComm();
  }

  /**
   * Get (or create) an existing comm to use as the control comm, or create one
   * with no language server
   */
  protected async getControlComm() {
    const kernel = await this.ensureKernel();
    const commInfo = await kernel.requestCommInfo({
      target_name: COMM_TARGET
    });

    if (commInfo.content.status !== 'ok') {
      return;
    }

    const commIds = Object.keys(commInfo.content.comms);
    const commId = commIds.length ? commIds[0] : null;

    // not _neccessarily_ the language server comm, but we can use it anyway
    // and it wil be re-connected later
    const comm = kernel.createComm(COMM_TARGET, ...(commId ? [commId] : []));
    comm.onMsg = this.onControlCommMsg.bind(this);
    comm.open({});

    return comm;
  }

  protected async onControlCommMsg(msg: KernelMessage.ICommMsgMsg) {
    const { sessions, uris } = msg.metadata as SCHEMA.ServersResponse;
    this._rootUri = uris.root;
    this._virtualDocumentsUri = uris.virtual_documents;
    this._sessions = new Map(Object.entries(sessions));
    this._sessionsChanged.emit(void 0);
    this._kernelReady.resolve(void 0);
  }

  protected async getLanguageServerComm(language_server_id: TLanguageServerId) {
    const kernel = await this.ensureKernel();

    const session = this._sessions.get(language_server_id);
    let commId = session.comm_ids.length ? session.comm_ids[0] : null;

    const comm = kernel.createComm(
      COMM_TARGET,
      ...(commId == null ? [] : [commId])
    );

    this._comms.set(language_server_id, comm);

    comm.onMsg = msg => {
      console.warn('unitialized comm', comm, msg.content.data);
    };

    if (commId == null) {
      comm.open({}, { language_server: language_server_id });
    }

    return comm;
  }

  async initKernel() {
    if (this._kernelSessionConnection) {
      this._kernelSessionConnection.dispose();
      this._kernelSessionConnection = null;
    }
    await this._serviceManager.ready;

    const session = (this._kernelSessionConnection = await this._serviceManager.sessions.startNew(
      {
        path: '/',
        type: '',
        name: 'language-server',
        kernel: { name: 'jupyter-lsp-kernel' }
      }
    ));

    session.kernelChanged.connect(async (sender, args) => {
      await this._handleKernelChanged(args);
    });

    const { kernel } = session;

    await this._handleKernelChanged({
      name: 'kernel',
      oldValue: null,
      newValue: kernel
    });
  }
}
