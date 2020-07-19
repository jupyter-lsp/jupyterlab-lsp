import * as LSP from '../lsp';

import { ICommRPC } from '.';
import { CommRPC } from './json-rpc';

/**
 * A client for the Language Server Protocol that can react to a single
 * Language Server.
 */
export class CommLSP extends CommRPC {
  // TODO: figure out a more robust way to do this
  // capabilities: LSP.TCapabilityMap = new Map();

  /**
   * Request immediate method execution on the Language Server, not waiting for
   * a response.
   */
  async notify<
    T extends keyof LSP.IClientNotifyParams,
    U extends LSP.IClientNotifyParams[T]
  >(method: T, params: U): Promise<null> {
    await this.communicate(method, params as any, ICommRPC.NO_WAIT);
    return null;
  }

  /**
   * Request method execution on the Language Server, hopefully returning a result
   * some time in the future.
   */
  async request<
    T extends keyof LSP.IClientRequestParams,
    U extends LSP.IClientRequestParams[T],
    V extends LSP.IClientResult[T]
  >(method: T, params: U): Promise<V> {
    // NB: not sure why this has to be so any-ful inside here, but it works outside
    return (await this.communicate(method, params as any)) as any;
  }

  /**
   * Handle a notification from the server.
   */
  onNotification<
    T extends keyof LSP.IServerNotifyParams,
    U extends LSP.IServerNotifyParams[T],
    V extends ICommRPC.IMethodHandler<U, void>
  >(method: T, handler: V): V | null {
    return this.addHandler(method, handler) as V;
  }

  /**
   * Handle request from the server. The handler should return a promise of a result.
   */
  onRequest<
    T extends keyof LSP.IServerRequestParams,
    U extends LSP.IServerRequestParams[T],
    V extends LSP.IServerResult[T],
    W extends ICommRPC.IMethodHandler<U, V>
  >(method: T, handler: W): W | null {
    return this.addHandler(method, handler) as W;
  }
}
