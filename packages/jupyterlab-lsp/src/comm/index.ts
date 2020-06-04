import { IComm, IShellFuture } from '@jupyterlab/services/lib/kernel/kernel';
import { ISignal, Signal } from '@lumino/signaling';
import { ICommMsgMsg } from '@jupyterlab/services/lib/kernel/messages';
import { JSONObject, PromiseDelegate, JSONValue } from '@lumino/coreutils';

export interface ICommRPC {
  comm: IComm;
  communicate<T extends ICommRPC.TRPCResult | null>(
    method: string,
    request: ICommRPC.TRPCParams,
    options?: ICommRPC.ICommunicateOptions
  ): Promise<T>;
  commChanged: ISignal<ICommRPC, void>;
  addHandler(
    method: string,
    handler: ICommRPC.IMethodHandler
  ): ICommRPC.IMethodHandler | null;
  removeHandler(method: string): ICommRPC.IMethodHandler | null;
}

export namespace ICommRPC {
  export const NO_WAIT: ICommunicateOptions = { noWait: true };

  export interface IOptions {
    comm: IRPCComm;
    jsonrpc?: string;
    handlers?: TMethodHandlers;
  }

  export interface ICommunicateOptions {
    noWait?: boolean;
  }

  export interface IRPCComm extends IComm {
    onMsg: (msg: IIRPCCommMsg) => void | PromiseLike<void>;
    send(
      data: IRPCRequest,
      metadata?: JSONObject,
      buffers?: (ArrayBuffer | ArrayBufferView)[],
      disposeOnDone?: boolean
    ): IShellFuture;
    send(
      data: IRPCResponse,
      metadata?: JSONObject,
      buffers?: (ArrayBuffer | ArrayBufferView)[],
      disposeOnDone?: boolean
    ): IShellFuture;
    send(
      data: IRPCError,
      metadata?: JSONObject,
      buffers?: (ArrayBuffer | ArrayBufferView)[],
      disposeOnDone?: boolean
    ): IShellFuture;
  }

  export interface IMethodHandler<
    T extends TRPCParams = any,
    U extends TRPCResult | null = any
  > {
    onMsg(params: T): Promise<U>;
    onAdd?(): void;
    onRemove?(): void;
  }

  export type TNotifications = Map<string, Signal<ICommRPC, any>>;

  export type TResultMap = Map<string | number, PromiseDelegate<TRPCResult>>;

  export type TMethodHandlers = Map<string, IMethodHandler>;

  export interface IBaseRPCMessage extends JSONObject {
    jsonrpc: string;
    id: string | number;
  }

  export type TRPCParams = any;

  export interface IRPCRequest extends IBaseRPCMessage {
    method: string;
    params: TRPCParams;
    result?: never;
    error?: never;
  }

  export type TRPCResult = any;

  export interface IRPCResponse extends IBaseRPCMessage {
    result: TRPCResult;
    method?: never;
    params?: never;
    error?: never;
  }

  export interface IRPCError extends IBaseRPCMessage {
    error: JSONValue;
    method?: never;
    params?: never;
    result?: never;
  }

  export type TRPCData = IRPCRequest | IRPCResponse | IRPCError;

  export interface IIRPCCommMsg extends ICommMsgMsg {
    content: {
      comm_id: string;
      data: TRPCData;
    };
  }
}
