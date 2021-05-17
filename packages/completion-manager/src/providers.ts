import { ISessionContext } from '@jupyterlab/apputils';
import { CompletionHandler, KernelConnector } from '@jupyterlab/completer';
import { LabIcon } from '@jupyterlab/ui-components';
import { JSONArray, JSONObject } from '@lumino/coreutils';

import {
  ICompletionRequest,
  ICompletionContext,
  ICompletionProvider,
  ICompletionsReply,
  ICompletionsSource,
  IExtendedCompletionItem
} from './tokens';

export interface IKernelProviderSettings {
  waitForBusyKernel: boolean;
}

export class KernelCompletionProvider implements ICompletionProvider {
  identifier = 'kernel';
  private _previousSession: ISessionContext;
  private _previousConnector: KernelConnector;

  constructor(public settings: IKernelProviderSettings) {
    this._previousSession = null;
  }

  protected get _should_wait_for_busy_kernel(): boolean {
    return this.settings.waitForBusyKernel;
  }

  // define once to avoid creation of many objects
  private _source: ICompletionsSource = {
    name: 'Kernel',
    priority: 1
  };

  private transform_reply(
    reply: CompletionHandler.IReply
  ): IExtendedCompletionItem[] {
    console.log('Transforming kernel reply:', reply);
    let items: IExtendedCompletionItem[];
    const metadata = reply.metadata || {};
    const types = metadata._jupyter_types_experimental as JSONArray;

    if (types) {
      items = types.map((item: JSONObject) => {
        return {
          label: item.text as string,
          insertText: item.text as string,
          type: item.type === '<unknown>' ? undefined : (item.type as string),
          sortText: item.text as string
          // sortText: this.kernel_completions_first ? 'a' : 'z'
        };
      });
    } else {
      items = reply.matches.map(match => {
        return {
          label: match,
          insertText: match,
          sortText: match
          // TODO add prefix in manager (for all sources depending on priority!)
          // sortText: this.kernel_completions_first ? 'a' : 'z'
        };
      });
    }
    return items;
  }

  _getConnector(context: ICompletionContext) {
    if (this._previousSession != context.sessionContext) {
      this._previousConnector = new KernelConnector({
        session: context.sessionContext.session
      });
      this._previousSession = context.sessionContext;
    }

    return this._previousConnector;
  }

  async isApplicable(request: ICompletionRequest, context: ICompletionContext) {
    const has_kernel = context.sessionContext.session?.kernel != null;
    if (!has_kernel) {
      return false;
    }

    const is_kernel_idle =
      context.sessionContext.session?.kernel?.status == 'idle';

    return is_kernel_idle || this._should_wait_for_busy_kernel;
  }

  async fetch(
    request: ICompletionRequest,
    context: ICompletionContext
  ): Promise<ICompletionsReply> {
    let kernel_connector = this._getConnector(context);
    return kernel_connector.fetch(request).then(reply => {
      return {
        items: this.transform_reply(reply),
        source: this._source
      } as ICompletionsReply;
    });
  }

  public setFallbackIcon(icon: LabIcon) {
    this._source.fallbackIcon = icon;
  }
}
