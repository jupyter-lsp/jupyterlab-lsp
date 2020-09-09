import {
  CompletionConnector,
  CompletionHandler,
  ContextConnector,
  KernelConnector
} from '@jupyterlab/completer';
import { CodeEditor } from '@jupyterlab/codeeditor';
import { JSONArray, JSONObject } from '@lumino/coreutils';
import {
  AdditionalCompletionTriggerKinds,
  CompletionItemKind,
  CompletionTriggerKind,
  ExtendedCompletionTriggerKind
} from '../../lsp';
import * as lsProtocol from 'vscode-languageserver-types';
import { VirtualDocument } from '../../virtual/document';
import { IVirtualEditor } from '../../virtual/editor';
import {
  IEditorPosition,
  IRootPosition,
  IVirtualPosition
} from '../../positioning';
import { LSPConnection } from '../../connection';
import { Session } from '@jupyterlab/services';

import { CodeCompletion as LSPCompletionSettings } from '../../_completion';
import { FeatureSettings } from '../../feature';
import { PositionConverter } from '../../converter';
import {
  ILSPCompletionThemeManager,
  KernelKind
} from '@krassowski/completion-theme/lib/types';
import { LabIcon } from '@jupyterlab/ui-components';
import ICompletionItemsResponseType = CompletionHandler.ICompletionItemsResponseType;

/**
 * A LSP connector for completion handlers.
 */
export class LSPConnector
  implements CompletionHandler.ICompletionItemsConnector {
  isDisposed = false;
  private _editor: CodeEditor.IEditor;
  private _connections: Map<VirtualDocument.id_path, LSPConnection>;
  private _context_connector: ContextConnector;
  private _kernel_connector: KernelConnector;
  private _kernel_and_context_connector: CompletionConnector;

  // signal that this is the new type connector (providing completion items)
  responseType = ICompletionItemsResponseType;

  virtual_editor: IVirtualEditor<CodeEditor.IEditor>;
  trigger_kind: ExtendedCompletionTriggerKind;

  protected get suppress_auto_invoke_in(): string[] {
    return this.options.settings.composite.suppressInvokeIn;
  }

  protected get should_show_documentation(): boolean {
    return this.options.settings.composite.showDocumentation;
  }

  /**
   * Create a new LSP connector for completion requests.
   *
   * @param options - The instantiation options for the LSP connector.
   */
  constructor(protected options: LSPConnector.IOptions) {
    this._editor = options.editor;
    this._connections = options.connections;
    this.virtual_editor = options.virtual_editor;
    this._context_connector = new ContextConnector({ editor: options.editor });
    if (options.session) {
      let kernel_options = { editor: options.editor, session: options.session };
      this._kernel_connector = new KernelConnector(kernel_options);
      this._kernel_and_context_connector = new CompletionConnector(
        kernel_options
      );
    }
  }

  dispose() {
    if (this.isDisposed) {
      return;
    }
    this._connections = null;
    this.virtual_editor = null;
    this._context_connector = null;
    this._kernel_connector = null;
    this._kernel_and_context_connector = null;
    this.options = null;
    this._editor = null;
    this.isDisposed = true;
  }

  protected get _has_kernel(): boolean {
    return this.options.session?.kernel != null;
  }

  protected async _kernel_language(): Promise<string> {
    return (await this.options.session.kernel.info).language_info.name;
  }

  get fallback_connector() {
    return this._kernel_and_context_connector
      ? this._kernel_and_context_connector
      : this._context_connector;
  }

  protected transform_from_editor_to_root(
    position: CodeEditor.IPosition
  ): IRootPosition {
    let editor_position = PositionConverter.ce_to_cm(
      position
    ) as IEditorPosition;
    return this.virtual_editor.transform_from_editor_to_root(
      this._editor,
      editor_position
    );
  }

  /**
   * Fetch completion requests.
   *
   * @param request - The completion request text and details.
   */
  async fetch(
    request: CompletionHandler.IRequest
  ): Promise<CompletionHandler.ICompletionItemsReply> {
    let editor = this._editor;

    const cursor = editor.getCursorPosition();
    const token = editor.getTokenForPosition(cursor);

    if (this.suppress_auto_invoke_in.indexOf(token.type) !== -1) {
      console.log('Suppressing completer auto-invoke in', token.type);
      return;
    }

    const start = editor.getPositionAt(token.offset);
    const end = editor.getPositionAt(token.offset + token.value.length);

    let position_in_token = cursor.column - start.column - 1;
    const typed_character = token.value[cursor.column - start.column - 1];

    let start_in_root = this.transform_from_editor_to_root(start);
    let end_in_root = this.transform_from_editor_to_root(end);
    let cursor_in_root = this.transform_from_editor_to_root(cursor);

    let virtual_editor = this.virtual_editor;

    // find document for position
    let document = virtual_editor.document_at_root_position(start_in_root);

    let virtual_start = virtual_editor.root_position_to_virtual_position(
      start_in_root
    );
    let virtual_end = virtual_editor.root_position_to_virtual_position(
      end_in_root
    );
    let virtual_cursor = virtual_editor.root_position_to_virtual_position(
      cursor_in_root
    );

    const lsp_promise = this.fetch_lsp(
      token,
      typed_character,
      virtual_start,
      virtual_end,
      virtual_cursor,
      document,
      position_in_token
    );
    let promise: Promise<CompletionHandler.ICompletionItemsReply> = null;

    try {
      if (this._kernel_connector && this._has_kernel) {
        // TODO: this would be awesome if we could connect to rpy2 for R suggestions in Python,
        //  but this is not the job of this extension; nevertheless its better to keep this in
        //  mind to avoid introducing design decisions which would make this impossible
        //  (for other extensions)
        const kernelLanguage = await this._kernel_language();

        if (document.language === kernelLanguage) {
          promise = Promise.all([
            this._kernel_connector.fetch(request),
            lsp_promise
          ]).then(([kernel, lsp]) =>
            this.merge_replies(this.transform_reply(kernel), lsp, this._editor)
          );
        }
      }
      if (!promise) {
        promise = lsp_promise.catch(e => {
          console.warn('LSP: hint failed', e);
          return this.fallback_connector
            .fetch(request)
            .then(this.transform_reply);
        });
      }
    } catch (e) {
      console.warn('LSP: kernel completions failed', e);
      promise = this.fallback_connector
        .fetch(request)
        .then(this.transform_reply);
    }

    return promise.then(reply => {
      reply = this.suppress_if_needed(reply);
      this.trigger_kind = CompletionTriggerKind.Invoked;
      return reply;
    });
  }

  async fetch_lsp(
    token: CodeEditor.IToken,
    typed_character: string,
    start: IVirtualPosition,
    end: IVirtualPosition,
    cursor: IVirtualPosition,
    document: VirtualDocument,
    position_in_token: number
  ): Promise<CompletionHandler.ICompletionItemsReply> {
    let connection = this._connections.get(document.id_path);

    console.log('[LSP][Completer] Fetching and Transforming');
    console.log('[LSP][Completer] Token:', token, start, end);

    const trigger_kind =
      this.trigger_kind == AdditionalCompletionTriggerKinds.AutoInvoked
        ? CompletionTriggerKind.Invoked
        : this.trigger_kind;

    let lspCompletionItems = ((await connection.getCompletion(
      cursor,
      {
        start,
        end,
        text: token.value
      },
      document.document_info,
      false,
      typed_character,
      trigger_kind
    )) || []) as lsProtocol.CompletionItem[];

    let prefix = token.value.slice(0, position_in_token + 1);
    let all_non_prefixed = true;
    let items: CompletionHandler.ICompletionItem[] = [];
    const show_documentation = this.should_show_documentation;
    lspCompletionItems.forEach(match => {
      let kind = match.kind ? CompletionItemKind[match.kind] : '';
      let completionItem = {
        label: match.label,
        insertText: match.insertText,
        type: kind,
        documentation: show_documentation
          ? lsProtocol.MarkupContent.is(match.documentation)
            ? match.documentation.value
            : match.documentation
          : null,
        filterText: match.filterText,
        deprecated: match.deprecated,
        data: { ...match }
      } as CompletionHandler.ICompletionItem;

      let icon = this.icon_for(kind);
      if (icon) {
        completionItem.icon = icon;
      }

      // Update prefix values
      let text = match.insertText ? match.insertText : match.label;
      if (text.toLowerCase().startsWith(prefix.toLowerCase())) {
        all_non_prefixed = false;
        if (prefix !== token.value) {
          if (text.toLowerCase().startsWith(token.value.toLowerCase())) {
            // given a completion insert text "display_table" and two test cases:
            // disp<tab>data →  display_table<cursor>data
            // disp<tab>lay  →  display_table<cursor>
            // we have to adjust the prefix for the latter (otherwise we would get display_table<cursor>lay),
            // as we are constrained NOT to replace after the prefix (which would be "disp" otherwise)
            prefix = token.value;
          }
        }
      }

      items.push(completionItem);
    });

    return {
      // note in the ContextCompleter it was:
      // start: token.offset,
      // end: token.offset + token.value.length,
      // which does not work with "from statistics import <tab>" as the last token ends at "t" of "import",
      // so the completer would append "mean" as "from statistics importmean" (without space!);
      // (in such a case the typedCharacters is undefined as we are out of range)
      // a different workaround would be to prepend the token.value prefix:
      // text = token.value + text;
      // but it did not work for "from statistics <tab>" and lead to "from statisticsimport" (no space)
      start: token.offset + (all_non_prefixed ? 1 : 0),
      end: token.offset + prefix.length,
      items: items
    };
  }

  protected icon_for(type: string): LabIcon {
    if (!this.options.settings.composite.theme) {
      return null;
    }
    if (type == null || type == '<unknown>') {
      type = KernelKind;
    }
    return (this.options.themeManager.get_icon(type) as LabIcon) || null;
  }

  private transform_typed_item(
    item: JSONObject
  ): CompletionHandler.ICompletionItem {
    return {
      label: item.text as string,
      insertText: item.text as string,
      type: item.type as string,
      icon: this.icon_for(item.type as string)
    };
  }

  private transform_untyped_match(
    match: string
  ): CompletionHandler.ICompletionItem {
    return {
      label: match,
      insertText: match,
      icon: this.icon_for(KernelKind)
    };
  }

  private transform_reply(
    reply: CompletionHandler.IReply
  ): CompletionHandler.ICompletionItemsReply {
    console.log('[LSP][Completer] Transforming kernel reply:', reply);
    let items: CompletionHandler.ICompletionItem[];
    const metadata = reply.metadata || {};
    const types = metadata._jupyter_types_experimental as JSONArray;

    if (types) {
      items = types.map(this.transform_typed_item, this);
    } else {
      items = reply.matches.map(this.transform_untyped_match, this);
    }
    return { start: reply.start, end: reply.end, items };
  }

  private merge_replies(
    kernel: CompletionHandler.ICompletionItemsReply,
    lsp: CompletionHandler.ICompletionItemsReply,
    editor: CodeEditor.IEditor
  ): CompletionHandler.ICompletionItemsReply {
    console.log('[LSP][Completer] Merging completions:', lsp, kernel);

    if (!kernel.items.length) {
      return lsp;
    }
    if (!lsp.items.length) {
      return kernel;
    }

    let prefix = '';

    // if the kernel used a wider range, get the previous characters to strip the prefix off,
    // so that both use the same range
    if (lsp.start > kernel.start) {
      const cursor = editor.getCursorPosition();
      const line = editor.getLine(cursor.line);
      prefix = line.substring(kernel.start, lsp.start);
      console.log('[LSP][Completer] Removing kernel prefix: ', prefix);
    } else if (lsp.start < kernel.start) {
      console.warn('[LSP][Completer] Kernel start > LSP start');
    }

    // combine completions, de-duping by insertText; LSP completions will show up first, kernel second.
    const aggregatedItems = lsp.items.concat(
      kernel.items.map(item => {
        return {
          ...item,
          insertText: item.insertText.startsWith(prefix)
            ? item.insertText.substr(prefix.length)
            : item.insertText
        };
      })
    );
    const insertTextSet = new Set<string>();
    const processedItems = new Array<CompletionHandler.ICompletionItem>();

    aggregatedItems.forEach(item => {
      if (insertTextSet.has(item.insertText)) {
        return;
      }
      insertTextSet.add(item.insertText);
      processedItems.push(item);
    });
    // TODO: Sort items
    // Return reply with processed items.
    console.log('[LSP][Completer] Merged: ', { ...lsp, items: processedItems });
    return { ...lsp, items: processedItems };
  }

  list(
    query: string | undefined
  ): Promise<{
    ids: CompletionHandler.IRequest[];
    values: CompletionHandler.ICompletionItemsReply[];
  }> {
    return Promise.resolve(void 0);
  }

  remove(id: CompletionHandler.IRequest): Promise<any> {
    return Promise.resolve(void 0);
  }

  save(id: CompletionHandler.IRequest, value: void): Promise<any> {
    return Promise.resolve(void 0);
  }

  private suppress_if_needed(reply: CompletionHandler.ICompletionItemsReply) {
    if (this.trigger_kind == AdditionalCompletionTriggerKinds.AutoInvoked) {
      if (reply.start == reply.end) {
        return {
          start: reply.start,
          end: reply.end,
          items: []
        };
      }
    }
    return reply;
  }
}

/**
 * A namespace for LSP connector statics.
 */
export namespace LSPConnector {
  /**
   * The instantiation options for cell completion handlers.
   */
  export interface IOptions {
    /**
     * The editor used by the LSP connector.
     */
    editor: CodeEditor.IEditor;
    virtual_editor: IVirtualEditor<CodeEditor.IEditor>;
    /**
     * The connections to be used by the LSP connector.
     */
    connections: Map<VirtualDocument.id_path, LSPConnection>;

    settings: FeatureSettings<LSPCompletionSettings>;

    themeManager: ILSPCompletionThemeManager;

    session?: Session.ISessionConnection;
  }
}
