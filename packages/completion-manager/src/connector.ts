import { CodeEditor } from '@jupyterlab/codeeditor';
import { CompletionHandler } from '@jupyterlab/completer';
import { LabIcon } from '@jupyterlab/ui-components';

import {
  CompletionTriggerKind,
  ICompletionContext,
  ICompletionProvider,
  ICompletionRequest,
  ICompletionSettings,
  ICompletionsReply,
  IExtendedCompletionItem,
  IIconSource
} from './tokens';

import ICompletionItemsResponseType = CompletionHandler.ICompletionItemsResponseType;
import ICompletionItemsReply = CompletionHandler.ICompletionItemsReply;

export interface IMultiSourceCompletionConnectorOptions {
  iconSource: IIconSource;
  providers: ICompletionProvider[];
  settings: ICompletionSettings;
  context: ICompletionContext;
}

interface IReplyWithProvider extends ICompletionsReply {
  provider: ICompletionProvider;
}

export class MultiSourceCompletionConnector
  implements CompletionHandler.ICompletionItemsConnector {
  // signal that this is the new type connector (providing completion items)
  responseType = ICompletionItemsResponseType;
  triggerKind: CompletionTriggerKind;

  constructor(protected options: IMultiSourceCompletionConnectorOptions) {}

  protected get suppress_continuous_hinting_in(): string[] {
    return this.options.settings.suppressContinuousHintingIn;
  }

  protected get suppress_trigger_character_in(): string[] {
    return this.options.settings.suppressTriggerCharacterIn;
  }

  async fetch(
    request: CompletionHandler.IRequest
  ): Promise<CompletionHandler.ICompletionItemsReply> {
    const editor = this.options.context.editor;
    const cursor = editor.getCursorPosition();
    const token = editor.getTokenForPosition(cursor);

    if (this.triggerKind == CompletionTriggerKind.AutoInvoked) {
      if (this.suppress_continuous_hinting_in.indexOf(token.type) !== -1) {
        console.debug('Suppressing completer auto-invoke in', token.type);
        return;
      }
    } else if (this.triggerKind == CompletionTriggerKind.TriggerCharacter) {
      if (this.suppress_trigger_character_in.indexOf(token.type) !== -1) {
        console.debug('Suppressing completer auto-invoke in', token.type);
        return;
      }
    }

    const promises: Promise<IReplyWithProvider>[] = [];

    for (const provider of this.options.providers) {
      const providerSettings = this.options.settings.providers[
        provider.identifier
      ];
      if (!providerSettings.enabled) {
        continue;
      }

      const wrappedRequest: ICompletionRequest = {
        triggerKind: this.triggerKind,
        ...request
      };

      await provider.isApplicable(wrappedRequest, this.options.context);

      let promise = provider
        .fetch(wrappedRequest, this.options.context)
        .then(reply => {
          return {
            provider: provider,
            ...reply
          };
        });

      const timeout = providerSettings.timeout;

      if (timeout != -1) {
        // implement timeout for the kernel response using Promise.race:
        // an empty completion result will resolve after the timeout
        // if actual kernel response does not beat it to it
        const timeoutPromise = new Promise<IReplyWithProvider>(resolve => {
          return setTimeout(() => resolve(null), timeout);
        });

        promise = Promise.race([promise, timeoutPromise]);
      }

      promises.push(promise.catch(p => p));
    }

    const combinedPromise: Promise<ICompletionsReply> = Promise.all(
      promises
    ).then(replies => {
      return this.mergeReplies(
        replies.filter(reply => reply != null),
        this.options.context.editor
      );
    });

    return combinedPromise.then(reply => {
      const transformedReply = this.suppressIfNeeded(reply, token, cursor);
      this.triggerKind = CompletionTriggerKind.Invoked;
      return transformedReply;
    });
  }

  private iconFor(type: string): LabIcon {
    return (this.options.iconSource.iconFor(type) as LabIcon) || undefined;
  }

  protected mergeReplies(
    replies: IReplyWithProvider[],
    editor: CodeEditor.IEditor
  ): ICompletionsReply {
    console.debug('Merging completions:', replies);

    replies = replies.filter(reply => {
      if (reply instanceof Error) {
        console.warn(`Caught ${reply.source.name} completions error`, reply);
        return false;
      }
      // ignore if no matches
      if (!reply.items.length) {
        return false;
      }
      // otherwise keep
      return true;
    });

    // TODO: why sort? should not use sortText instead?
    replies.sort((a, b) => b.source.priority - a.source.priority);

    console.debug('Sorted replies:', replies);

    const minEnd = Math.min(...replies.map(reply => reply.end));

    // if any of the replies uses a wider range, we need to align them
    // so that all responses use the same range
    const minStart = Math.min(...replies.map(reply => reply.start));
    const maxStart = Math.max(...replies.map(reply => reply.start));

    if (minStart != maxStart) {
      const cursor = editor.getCursorPosition();
      const line = editor.getLine(cursor.line);

      replies = replies.map(reply => {
        // no prefix to strip, return as-is
        if (reply.start == maxStart) {
          return reply;
        }
        let prefix = line.substring(reply.start, maxStart);
        console.debug(`Removing ${reply.source.name} prefix: `, prefix);
        return {
          ...reply,
          items: reply.items.map(item => {
            item.insertText = item.insertText.startsWith(prefix)
              ? item.insertText.substr(prefix.length)
              : item.insertText;
            return item;
          })
        };
      });
    }

    const insertTextSet = new Set<string>();
    const processedItems = new Array<IExtendedCompletionItem>();

    for (const reply of replies) {
      reply.items.forEach(item => {
        // trimming because:
        // IPython returns 'import' and 'import '; while the latter is more useful,
        // user should not see two suggestions with identical labels and nearly-identical
        // behaviour as they could not distinguish the two either way
        let text = item.insertText.trim();
        if (insertTextSet.has(text)) {
          return;
        }
        insertTextSet.add(text);
        // extra processing (adding icon/source name) is delayed until
        // we are sure that the item will be kept (as otherwise it could
        // lead to processing hundreds of suggestions - e.g. from numpy
        // multiple times if multiple sources provide them).
        let processedItem = item as IExtendedCompletionItem;
        processedItem.source = reply.source;
        processedItem.provider = reply.provider;
        if (!processedItem.icon) {
          // try to get icon based on type or use source fallback if no icon matched
          processedItem.icon =
            this.iconFor(processedItem.type) || reply.source.fallbackIcon;
        }
        processedItems.push(processedItem);
      });
    }

    // Return reply with processed items.
    console.debug('Merged: ', processedItems);
    return {
      start: maxStart,
      end: minEnd,
      source: null,
      items: processedItems
    };
  }

  list(
    query: string | undefined
  ): Promise<{
    ids: CompletionHandler.IRequest[];
    values: CompletionHandler.ICompletionItemsReply[];
  }> {
    return Promise.resolve(undefined);
  }

  remove(id: CompletionHandler.IRequest): Promise<any> {
    return Promise.resolve(undefined);
  }

  save(id: CompletionHandler.IRequest, value: void): Promise<any> {
    return Promise.resolve(undefined);
  }

  private suppressIfNeeded(
    reply: ICompletionsReply,
    token: CodeEditor.IToken,
    cursor_at_request: CodeEditor.IPosition
  ): ICompletionItemsReply {
    const editor = this.options.context.editor;
    if (!editor.hasFocus()) {
      console.debug(
        'Ignoring completion response: the corresponding editor lost focus'
      );
      return {
        start: reply.start,
        end: reply.end,
        items: []
      };
    }

    const cursor_now = editor.getCursorPosition();

    // if the cursor advanced in the same line, the previously retrieved completions may still be useful
    // if the line changed or cursor moved backwards then no reason to keep the suggestions
    if (
      cursor_at_request.line != cursor_now.line ||
      cursor_now.column < cursor_at_request.column
    ) {
      console.debug(
        'Ignoring completion response: cursor has receded or changed line'
      );
      return {
        start: reply.start,
        end: reply.end,
        items: []
      };
    }

    if (this.triggerKind == CompletionTriggerKind.AutoInvoked) {
      if (
        // do not auto-invoke if no match found
        reply.start == reply.end ||
        // do not auto-invoke if only one match found and this match is exactly the same as the current token
        (reply.items.length === 1 && reply.items[0].insertText === token.value)
      ) {
        return {
          start: reply.start,
          end: reply.end,
          items: []
        };
      }
    }
    return reply as ICompletionItemsReply;
  }
}
