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

  constructor(options: ICommRPC.IOptions) {
    this._commChanged = new Signal(this);
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
  }

  /**
   * A signal for when the underlying comm changes
   */
  get commChanged() {
    return this._commChanged;
  }

  /**
   * Send an RPC message that expects a response at some time in the future
   */
  async communicate<T extends ICommRPC.TRPCResult>(
    method: string,
    params: ICommRPC.TRPCParams,
    options?: ICommRPC.ICommunicateOptions
  ): Promise<T> {
    const id = this.getNextId();
    let promise: Promise<T>;
    if (options?.noWait === true) {
      const delegate = new PromiseDelegate<T>();
      this._responsePromises.set(id, delegate);
      promise = delegate.promise;
    }
    // nb: just dropping the future on the ground
    this.comm.send({ jsonrpc: this._jsonrpc, id, method, params });
    return promise;
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
    const { result, id, params, method } = msg.content
      .data as ICommRPC.TRPCData;

    if (result != null) {
      const promise = this._responsePromises.get(id);
      if (promise == null) {
        console.warn('unexpected comm response', result, id, params);
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

    console.warn('unhandled message', method);
  }
}
