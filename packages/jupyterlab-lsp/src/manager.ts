import { PromiseDelegate } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';

import {
  // ServerConnection,
  ServiceManager,
  KernelMessage,
} from '@jupyterlab/services';

import {
  ILanguageServerManager,
  TSessionMap,
  TCommMap,
  TLanguageServerId,
} from './tokens';
import * as SCHEMA from './_schema';
import { ISessionConnection } from '@jupyterlab/services/lib/session/session';
import { IComm } from '@jupyterlab/services/lib/kernel/kernel';

const CONTROL_COMM_TARGET = 'jupyter.lsp.control';
const LANGUAGE_SERVER_COMM_TARGET = 'jupyter.lsp.language_server';

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
    this.initKernel().catch(console.warn);
  }

  get sessionsChanged() {
    return this._sessionsChanged;
  }

  get sessions(): TSessionMap {
    return this._sessions;
  }

  get kernelReady() {
    return this._kernelReady.promise;
  }

  async getComm(language_server_id: TLanguageServerId): Promise<IComm> {
    let comm = this._comms.get(language_server_id);

    if (comm != null) {
      return comm;
    }

    // nb: check sessions first?
    comm = await this.makeLanguageServerComm(language_server_id);
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
    newValue,
  }: ISessionConnection.IKernelChangedArgs): Promise<void> {
    if (this._controlComm) {
      this._controlComm = null;
    }

    if (newValue == null) {
      return;
    }

    this._controlComm = await this.makeControlComm();
  }

  protected async makeControlComm() {
    const comm = this._kernelSessionConnection.kernel.createComm(
      CONTROL_COMM_TARGET
    );

    comm.onMsg = this.onControlCommMsg.bind(this);

    // nb: do something here? negotiate schema version?
    comm.open({});
    console.warn('control comm opened', comm);
    // nb: should we await something?
    return comm;
  }

  async onControlCommMsg(msg: KernelMessage.ICommMsgMsg) {
    console.warn('got control message', this._controlComm, msg);

    const { sessions, uris } = msg.content.data as SCHEMA.ServersResponse;
    this._rootUri = uris.root;
    this._virtualDocumentsUri = uris.virtual_documents;
    this._sessions = new Map(Object.entries(sessions));
    this._sessionsChanged.emit(void 0);
    this._kernelReady.resolve(void 0);
  }

  protected async makeLanguageServerComm(
    language_server_id: TLanguageServerId
  ) {
    await this._kernelReady.promise;

    const comm = this._kernelSessionConnection.kernel.createComm(
      LANGUAGE_SERVER_COMM_TARGET
    );

    this._comms.set(language_server_id, comm);

    comm.onMsg = (msg) => {
      console.warn('unitialized comm', comm, msg.content.data);
    };

    comm.open({}, { language_server: language_server_id });

    console.warn('opened comm for', language_server_id);
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
        kernel: { name: 'jupyter-lsp-kernel' },
      }
    ));

    session.kernelChanged.connect(async (sender, args) => {
      await this._handleKernelChanged(args);
    });

    const { kernel } = session;

    await this._handleKernelChanged({
      name: 'kernel',
      oldValue: null,
      newValue: kernel,
    });
  }
}
