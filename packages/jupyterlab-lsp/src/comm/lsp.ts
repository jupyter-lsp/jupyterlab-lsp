import * as LSP from 'vscode-languageserver-protocol';

import { ICommRPC } from '.';
import { CommRPC } from './json-rpc';

/**
 * A client for the Language Server Protocol that can react to a single
 * Language Server.
 */
export class CommLSP extends CommRPC {
  /**
   * Request immediate method execution on the Language Server, not waiting for
   * a response.
   */
  async notify<
    T extends keyof CommLSP.IClientNotifyParams,
    U extends CommLSP.IClientNotifyParams[T]
  >(method: T, params: U): Promise<null> {
    await this.communicate(method, params as any, ICommRPC.NO_WAIT);
    return null;
  }

  /**
   * Request method execution on the Language Server, hopefully returning a result
   * some time in the future.
   */
  async request<
    T extends keyof CommLSP.IClientRequestParams,
    U extends CommLSP.IClientRequestParams[T],
    V extends CommLSP.IClientResult[T]
  >(method: T, params: U): Promise<V> {
    // NB: not sure why this has to be so any-ful inside here, but it works outside
    return (await this.communicate(method, params as any)) as any;
  }

  /**
   * Handle a notification from the server.
   */
  onNotification<
    T extends keyof CommLSP.IServerNotifyParams,
    U extends CommLSP.IServerNotifyParams[T],
    V extends ICommRPC.IMethodHandler<U, void>
  >(method: T, handler: V): V | null {
    return this.addHandler(method, handler) as V;
  }

  /**
   * Handle request from the server. The handler should return a promise of a result.
   */
  onRequest<
    T extends keyof CommLSP.IServerRequestParams,
    U extends CommLSP.IServerRequestParams[T],
    V extends CommLSP.IServerResult[T],
    W extends ICommRPC.IMethodHandler<U, V>
  >(method: T, handler: W): W | null {
    return this.addHandler(method, handler) as W;
  }

  // nb: test something like this
  async bar() {
    this.onRequest(CommLSP.REGISTER_CAPABILITY, {
      onMsg: async params => {
        console.log(params);
        return {
          id: 'foo',
          method: 'baz',
          registerOptions: { boo: true }
        };
      }
    });

    this.onNotification(CommLSP.PUBLISH_DIAGNOSTICS, {
      onMsg: async params => {
        console.log(params);
      }
    });

    const baz = await this.notify(CommLSP.INITIALIZED, {});
    console.log(baz);

    const boo = await this.request(CommLSP.HOVER, {
      textDocument: { uri: 'http' },
      position: {
        line: 0,
        character: 0
      }
    });
    console.log(boo);
  }
}

/**
 * A namespace for Comm-based LSP
 *
 */
export namespace CommLSP {
  /**
   * Magic strings are reproduced here because a non-typing import of
   * `vscode-languageserver-protocol` is ridiculously expensive
   *
   * This seems to be LSP 3.15
   */

  // TODO: break up by server/request/notification
  export const COMPLETION = 'textDocument/completion';
  export const COMPLETION_ITEM_RESOLVE = 'completionItem/resolve';
  export const DEFINITION = 'textDocument/definition';
  export const DOCUMENT_HIGHLIGHT = 'textDocument/documentHighlight';
  export const HOVER = 'textDocument/hover';
  export const IMPLEMENTATION = 'textDocument/implementation';
  export const INITIALIZE = 'initialize';
  export const INITIALIZED = 'initialized';
  export const PUBLISH_DIAGNOSTICS = 'textDocument/publishDiagnostics';
  export const REFERENCES = 'textDocument/references';
  export const SHOW_MESSAGE = 'window/showMessage';
  export const SIGNATURE_HELP = 'textDocument/signatureHelp';
  export const TYPE_DEFINITION = 'textDocument/typeDefinition';
  export const RENAME = 'textDocument/rename';
  export const DOCUMENT_SYMBOL = 'textDocument/documentSymbol';

  /** Server request params */
  export const REGISTER_CAPABILITY = 'client/registerCapability';
  export const UNREGISTER_CAPABILITY = 'client/unregisterCapability';

  export type TAnyCompletion = LSP.CompletionList | LSP.CompletionItem[] | null;

  export type TAnyLocation =
    | LSP.Location
    | LSP.Location[]
    | LSP.LocationLink[]
    | null;

  export interface IServerNotifyParams {
    [PUBLISH_DIAGNOSTICS]: LSP.PublishDiagnosticsParams;
    [SHOW_MESSAGE]: LSP.ShowMessageParams;
  }

  export interface IServerRequestParams {
    [REGISTER_CAPABILITY]: LSP.RegistrationParams;
    [UNREGISTER_CAPABILITY]: LSP.UnregistrationParams;
  }

  export interface IServerResult {
    [REGISTER_CAPABILITY]: LSP.Registration;
    [UNREGISTER_CAPABILITY]: LSP.Unregistration;
  }

  export interface IClientNotifyParams {
    [INITIALIZED]: LSP.InitializedParams;
  }

  export interface IClientRequestParams {
    [COMPLETION_ITEM_RESOLVE]: LSP.CompletionItem;
    [COMPLETION]: LSP.CompletionParams;
    [DEFINITION]: LSP.TextDocumentPositionParams;
    [DOCUMENT_HIGHLIGHT]: LSP.TextDocumentPositionParams;
    [HOVER]: LSP.TextDocumentPositionParams;
    [IMPLEMENTATION]: LSP.TextDocumentPositionParams;
    [INITIALIZE]: LSP.InitializeParams;
    [REFERENCES]: LSP.ReferenceParams;
    [SIGNATURE_HELP]: LSP.TextDocumentPositionParams;
    [TYPE_DEFINITION]: LSP.TextDocumentPositionParams;
    [RENAME]: LSP.RenameParams;
    [DOCUMENT_SYMBOL]: LSP.DocumentSymbolParams;
  }

  export interface IClientResult {
    [COMPLETION_ITEM_RESOLVE]: LSP.CompletionItem;
    [COMPLETION]: TAnyCompletion;
    [DEFINITION]: TAnyLocation;
    [DOCUMENT_HIGHLIGHT]: LSP.DocumentHighlight[];
    [HOVER]: LSP.Hover;
    [IMPLEMENTATION]: TAnyLocation;
    [INITIALIZE]: LSP.InitializeResult;
    [REFERENCES]: LSP.Location[];
    [SIGNATURE_HELP]: LSP.SignatureHelp;
    [TYPE_DEFINITION]: TAnyLocation;
    [RENAME]: LSP.WorkspaceEdit;
    [DOCUMENT_SYMBOL]: LSP.DocumentSymbol[];
  }
}
