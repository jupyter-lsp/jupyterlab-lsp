import { Signal } from '@lumino/signaling';
import { PromiseDelegate } from '@lumino/coreutils';

import { ICommRPC } from '.';

const DEFAULT_JSONRPC = '2.0';

/**
 * A JSON-RPC connection backed by Jupyter Kernel Comms
 */
export class CommRPC implements ICommRPC {
  protected _comm: ICommRPC.IRPCComm;
  protected _commChanged: Signal<ICommRPC, void>;
  protected _responsePromises: ICommRPC.TResultMap = new Map();
  protected _nextId = 0;
  protected _jsonrpc: string;
  protected _handlers: ICommRPC.TMethodHandlers = new Map();
  protected _commDisposed: Signal<ICommRPC, void>;
  protected _commRequested: PromiseDelegate<void>;

  constructor(options: ICommRPC.IOptions) {
    this._commChanged = new Signal(this);
    this._commDisposed = new Signal(this);
    this._jsonrpc = options.jsonrpc || DEFAULT_JSONRPC;
    if (options.handlers) {
      for (const [method, handler] of options.handlers.entries()) {
        this.addHandler(method, handler);
      }
    }
    this.comm = options.comm;
  }

  get comm(): ICommRPC.IRPCComm {
    return this._comm;
  }

  set comm(comm: ICommRPC.IRPCComm) {
    if (this._comm) {
      this._comm.onMsg = null;
    }

    this._comm = comm;

    if (this._comm) {
      this._comm.onMsg = this.handleMessage.bind(this);
    }
    this._commChanged.emit(void 0);
    if (this._commRequested != null) {
      this._commRequested.resolve(void 0);
    }
  }

  /**
   * Signals when the underlying comm changes
   */
  get commChanged() {
    return this._commChanged;
  }

  /**
   * Signals when the underlying comm is found to be disposed
   */
  get commDisposed() {
    return this._commDisposed;
  }

  /**
   * Send an RPC message that expects a response at some time in the future
   */
  async communicate<T extends ICommRPC.TRPCResult>(
    method: string,
    params: ICommRPC.TRPCParams,
    options?: ICommRPC.ICommunicateOptions
  ): Promise<T> {
    const delegate = new PromiseDelegate<T>();
    const noWait = options?.noWait === true;

    let msg: any = { jsonrpc: this._jsonrpc, method, params };

    if (!noWait) {
      msg.id = this.getNextId();
      this._responsePromises.set(msg.id, delegate);
    }

    if (this.comm.isDisposed) {
      if (this._commRequested == null) {
        this._commRequested = new PromiseDelegate();
        this._commDisposed.emit(void 0);
      }
      await this._commRequested.promise;
      this._commRequested = null;
    }

    this.comm.send(msg, null, null, true);

    if (noWait) {
      delegate.resolve(null);
    }

    return delegate.promise;
  }

  addHandler(
    method: string,
    handler: ICommRPC.IMethodHandler
  ): ICommRPC.IMethodHandler | null {
    const oldHandler = this._handlers.get(method);
    if (oldHandler != null) {
      this.removeHandler(method);
    }
    this._handlers.set(method, handler);
    if (handler.onAdd) {
      handler.onAdd();
    }
    return oldHandler;
  }

  removeHandler(method: string): ICommRPC.IMethodHandler {
    const handler = this._handlers.get(method);
    if (handler != null) {
      if (handler.onRemove != null) {
        handler.onRemove();
      }
      this._handlers.delete(method);
    }
    return handler;
  }

  /**
   * increment
   */
  protected getNextId() {
    return this._nextId++;
  }

  /**
   * Resolve a previously-requested method, or notify on the appropriate signal
   */
  protected handleMessage(msg: ICommRPC.IIRPCCommMsg) {
    const { result, id, params, method, error } = msg.content
      .data as ICommRPC.TRPCData;

    if (error) {
      console.warn(error);
    }

    if (result != null) {
      const promise = this._responsePromises.get(id);
      if (promise == null) {
        console.warn(
          'unexpected comm response',
          result,
          id,
          params,
          this.comm.commId
        );
        return;
      }
      promise.resolve(result);
      this._responsePromises.delete(id);
      return;
    }

    if (method != null) {
      const handler = this._handlers.get(method);
      if (handler != null) {
        handler
          .onMsg(params)
          .then(result => {
            if (result != null) {
              this.comm.send({ jsonrpc: this._jsonrpc, id, result });
            }
          })
          .catch(error => {
            if (error?.rpcError) {
              this.comm.send({
                jsonrpc: this._jsonrpc,
                id,
                error: error.rpcError
              });
            } else {
              throw error;
            }
          });
        return;
      }
    }
  }
}
