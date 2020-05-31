import { Signal } from '@lumino/signaling';

import { PageConfig, URLExt } from '@jupyterlab/coreutils';
import {
  ServerConnection,
  ServiceManager,
  KernelMessage
} from '@jupyterlab/services';

import { ILanguageServerManager, TSessionMap } from './tokens';
import * as SCHEMA from './_schema';
import { ISessionConnection } from '@jupyterlab/services/lib/session/session';
import { IComm } from '@jupyterlab/services/lib/kernel/kernel';

const CONTROL_COMM_TARGET = 'jupyter.lsp.control';
const SERVER_COMM_TARGET = 'jupyter.lsp.server';

export class LanguageServerManager implements ILanguageServerManager {
                protected _sessionsChanged: Signal<
           ILanguageServerManager,
           void
         > = new Signal<ILanguageServerManager, void
      >(this);
                protected _sessions: TSessionMap = new Map();
                private _settings: ServerConnection.ISettings;
                private _baseUrl: string;
                       private _serviceManager: ServiceManager;
         private _kernelSessionConnection: ISessionConnection;

                constructor(options: ILanguageServerManager.IOptions) {
                  this._settings = options.settings || ServerConnection.makeSettings();
                  this._baseUrl = options.baseUrl || PageConfig.getBaseUrl();
                  this._serviceManager = options.serviceManager;
                  this.fetchSessions().catch(console.warn);
                                this.initKernel().catch(console.warn);
         }

         get statusUrl() {
                  return URLExt.join(
             this._baseUrl,
             ILanguageServerManager.URL_NS,
             'status'

                         );
                }

                get sessionsChanged() {
                  return this._sessionsChanged;
         }

         get sessions(): TSessionMap {
                  return this._sessions;
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

                       async fetchSessions() {
                                let response = await ServerConnection.makeRequest(
                    this.statusUrl,
                    { method: 'GET' },
                           this._settings
           );

           if (!response.ok) {
             throw new Error(response.statusText);
                  }

           let sessions: SCHEMA.Sessions;

                  try {
                    sessions = (await response.json()).sessions;
           } catch (err) {
                           console.warn(err);
             return;
                         }

                  for (const key of Object.keys(sessions)) {
                   if  (this._sessions.has(key)) {
                      Object.assign(this._sessions.get(key), sessions[key]);
                    } else {
                             this._sessions.set(key, sessions[key]);
             }
           }

           const oldKeys = this._sessions.keys();

           for (const oldKey in oldKeys) {
             if (!sessions[oldKey]) {
               this._sessions.delete(oldKey
             );
                           }
           }

           this._sessionsChanged.emit(void 0);
         }

         /**
          * Register a new kernel
          */
         protected _handleKernelChanged({
           oldValue,
                  newValue
         }: ISessionConnection.IKernelChangedArgs): void {
           if (oldValue) {
             oldValue.removeCommTarget(
               SERVER_COMM_TARGET,
               this._handleServerCommOpen

                    );
                         }

                  if (newValue) {
             newValue.registerCommTarget(
               SERVER_COMM_TARGET,
               this._handleServerCommOpen
             );
             console.warn('server comm registered');
                         }
                              }

                       _handleServerCommOpen(comm: IComm, msg: KernelMessage.ICommOpenMsg) {
           console.warn('server comm openened', comm, msg);
         }

         async initKernel() {
           if (this._kernelSessionConnection) {
                    this._kernelSessionConnection.dispose();
             this._kernelSessionConnection = null;
           }
           await this._serviceManager.ready;

                         const session = (       this._kernelSessionConnection = await this._serviceManager.sessions.startNew(
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

           const opened = controlComm.open({ 1: 2 }, { 3: 4 });
           await opened.done;

           const future = controlComm.send({ foo: 'bar' }, { baz: 'boo' });
           await future.done;

           console.warn('sent a control message');

           // console.warn('comm', comm, future);
         }
       }
