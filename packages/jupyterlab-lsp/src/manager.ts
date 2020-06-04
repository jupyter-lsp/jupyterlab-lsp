import { Signal } from '@lumino/signaling';

import { PageConfig, URLExt } from '@jupyterlab/coreutils';
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

const CONTROL_COMM_TARGET = 'jupyter.lsp.control';
const SERVER_COMM_TARGET = 'jupyter.lsp.server';

export class LanguageServerManager implements ILanguageServerManager {
  protected _sessionsChanged: Signal<ILanguageServerManager, void> = new Signal<
    ILanguageServerManager,
    void
  >(this);
  protected _sessions: TSessionMap = new Map();
  protected _comms: TCommMap = new Map();
  // private _settings: ServerConnection.ISettings;
  private _baseUrl: string;
  private _serviceManager: ServiceManager;
  private _kernelSessionConnection: ISessionConnection;

  constructor(options: ILanguageServerManager.IOptions) {
    // this._settings = options.settings || ServerConnection.makeSettings();
    this._baseUrl = options.baseUrl || PageConfig.getBaseUrl();
    this._serviceManager = options.serviceManager;
    this.initKernel().catch(console.warn);
  }

  get statusUrl() {
    return URLExt.join(this._baseUrl, ILanguageServerManager.URL_NS, 'status');
  }

  get sessionsChanged() {
    return this._sessionsChanged;
  }

  get sessions(): TSessionMap {
    return this._sessions;
  }

  async getComm(language_server_id: TLanguageServerId): Promise<IComm> {
    return this._comms.get(language_server_id);
  }

  getServerId(options: ILanguageServerManager.IGetServerIdOptions) {
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

  /**
   * Register a new kernel
   */
  protected _handleKernelChanged({
    oldValue,
    newValue
  }: ISessionConnection.IKernelChangedArgs): void {
    if (oldValue) {
      oldValue.removeCommTarget(SERVER_COMM_TARGET, this._handleServerCommOpen);
    }

    if (newValue) {
      newValue.registerCommTarget(
        SERVER_COMM_TARGET,
        async (comm, msg) => await this._handleServerCommOpen(comm, msg)
      );

      console.warn('server comm registered');
    }
  }

  async _handleServerCommOpen(comm: IComm, msg: KernelMessage.ICommOpenMsg) {
    console.warn('server comm openened', comm, msg);
    const { metadata } = msg;
    const language_server = `${metadata.language_server}`;
    this._comms.set(language_server, comm);
    comm.onMsg = msg => {
      console.log('msg', comm, msg.content.data);
    };
    this._sessions.set(
      language_server,
      (metadata.session as any) as SCHEMA.LanguageServerSession
    );
    this._sessionsChanged.emit(void 0);
    // nb: put this in connection manager?
    const { CommLSP } = await import(
      /* webpackChunkName: "jupyter-lsp-comms" */ './comm/lsp'
    );
    const lspComm = new CommLSP({ comm });
    console.warn(lspComm);
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

    session.kernelChanged.connect((sender, args) => {
      this._handleKernelChanged(args);
    });

    const { kernel } = session;

    this._handleKernelChanged({
      name: 'kernel',
      oldValue: null,
      newValue: kernel
    });

    const controlComm = session.kernel.createComm(CONTROL_COMM_TARGET);

    controlComm.onMsg = (msg: KernelMessage.ICommMsgMsg) => {
      console.log('we got a control message', controlComm, msg);
    };

    const opened = controlComm.open({});
    await opened.done;

    console.warn('sent a control message');
    console.log(this._comms);
  }
}
