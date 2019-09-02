import { DataConnector } from '@jupyterlab/coreutils';
import {
  CompletionHandler,
  ContextConnector,
  KernelConnector,
  CompletionConnector
} from '@jupyterlab/completer';
import { CodeEditor } from '@jupyterlab/codeeditor';
import { LspWsConnection } from 'lsp-editor-adapter';
import { ReadonlyJSONObject } from '@phosphor/coreutils';
import { completionItemKindNames } from './lsp';
import { until_ready } from './utils';
import { PositionConverter } from './converter';
import { IClientSession } from '@jupyterlab/apputils';
import { VirtualDocument } from './virtual/document';
import { VirtualEditor } from './virtual/editor';
import { CodeMirrorEditor } from '@jupyterlab/codemirror';
import {
  IEditorPosition,
  IRootPosition,
  IVirtualPosition
} from './positioning';

/*
Feedback: anchor - not clear from docs
bundle - very not clear from the docs, interface or better docs would be nice to have
 */

/**
 * A LSP connector for completion handlers.
 */
export class LSPConnector extends DataConnector<
  CompletionHandler.IReply,
  void,
  CompletionHandler.IRequest
> {
  private readonly _editor: CodeEditor.IEditor;
  private readonly _connections: Map<VirtualDocument.id_path, LspWsConnection>;
  // completion characters do not belong here, but to "onChanged"
  // private _completion_characters: DefaultMap<
  //  VirtualDocument.id_path,
  //  Array<string>
  // >;
  private _context_connector: ContextConnector;
  private _kernel_connector: KernelConnector;
  private _kernel_and_context_connector: CompletionConnector;
  protected options: LSPConnector.IOptions;

  virtual_editor: VirtualEditor;

  /**
   * Create a new LSP connector for completion requests.
   *
   * @param options - The instantiation options for the LSP connector.
   */
  constructor(options: LSPConnector.IOptions) {
    super();
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
    this.options = options;
  }

  protected get _kernel_language(): string {
    return this.options.session.kernel.info.language_info.name;
  }

  get fallback_connector() {
    return this._kernel_and_context_connector
      ? this._kernel_and_context_connector
      : this._context_connector;
  }

  transform_from_editor_to_root(position: CodeEditor.IPosition): IRootPosition {
    let cm_editor = (this._editor as CodeMirrorEditor).editor;
    let cm_start = PositionConverter.ce_to_cm(position) as IEditorPosition;
    return this.virtual_editor.transform_editor_to_root(cm_editor, cm_start);
  }

  /**
   * Fetch completion requests.
   *
   * @param request - The completion request text and details.
   */
  fetch(
    request: CompletionHandler.IRequest
  ): Promise<CompletionHandler.IReply> {
    let editor = this._editor;

    const cursor = editor.getCursorPosition();
    const token = editor.getTokenForPosition(cursor);

    const start = editor.getPositionAt(token.offset);
    const end = editor.getPositionAt(token.offset + token.value.length);

    const typed_character = token.value[cursor.column - start.column - 1];

    let start_in_root = this.transform_from_editor_to_root(start);
    let end_in_root = this.transform_from_editor_to_root(end);
    let cursor_in_root = this.transform_from_editor_to_root(cursor);

    let virtual_editor = this.virtual_editor;

    // find document for position
    let document = virtual_editor.document_as_root_position(start_in_root);

    let virtual_start = virtual_editor.root_position_to_virtual_position(start_in_root);
    let virtual_end = virtual_editor.root_position_to_virtual_position(end_in_root);
    let virtual_cursor = virtual_editor.root_position_to_virtual_position(cursor_in_root);

    try {
      if (
        this._kernel_connector &&
        // TODO: this would be awesome if we could connect to rpy2 for R suggestions in Python,
        //  but this is not the job of this extension; nevertheless its better to keep this in
        //  mind to avoid introducing design decisions which would make this impossible
        //  (for other extensions)
        document.language === this._kernel_language
      ) {
        return Promise.all([
          this._kernel_connector.fetch(request),
          this.hint(
            token,
            typed_character,
            virtual_start,
            virtual_end,
            virtual_cursor,
            document
          )
        ]).then(([kernel, lsp]) =>
          this.merge_replies(kernel, lsp, this._editor)
        );
      }

      return this.hint(
        token,
        typed_character,
        virtual_start,
        virtual_end,
        virtual_cursor,
        document
      ).catch(e => {
        console.log(e);
        return this.fallback_connector.fetch(request);
      });
    } catch (e) {
      return this.fallback_connector.fetch(request);
    }
  }

  async hint(
    token: CodeEditor.IToken,
    typed_character: string,
    start: IVirtualPosition,
    end: IVirtualPosition,
    cursor: IVirtualPosition,
    document: VirtualDocument
  ): Promise<CompletionHandler.IReply> {
    let connection = this._connections.get(document.id_path);

    // without sendChange we (sometimes) get outdated suggestions
    connection.sendChange();

    // let request_completion: Function;
    let event: string;

    // nope - do not do this; we need to get the signature (yes)
    // but only in order to bump the priority of the parameters!
    // unfortunately there is no abstraction of scores exposed
    // to the matches...
    // Suggested in https://github.com/jupyterlab/jupyterlab/issues/7044, TODO PR

    event = 'completion';
    console.log(token);

    connection.getCompletion(
      cursor,
      {
        start,
        end,
        text: token.value
      },
      typed_character
      // lsProtocol.CompletionTriggerKind.TriggerCharacter,
    );
    let result: any = { set: false };

    // in Node v11.13.0, once() was added which would enable using native promises, see:
    // https://nodejs.org/api/events.html#events_events_once_emitter_name
    // but it has not been implemented in 'events':
    // https://nodejs.org/api/events.html
    // yet (as for today they match Node.js v10.1)
    // There is an issue:
    // https://github.com/Gozala/events/issues/63

    // TODO leaky leak ('MaxListenersExceededWarning'), IMO it only happens when the callback fails...
    connection.once(event, (args: any) => {
      result.value = args;
      result.set = true;
      return args;
    });
    await until_ready(() => result.set);

    let matches: Array<string> = [];
    const types: Array<IItemType> = [];
    let all_non_prefixed = true;
    for (let match of result.value) {
      // there are more interesting things to be extracted and passed to the metadata:
      // detail: "__main__"
      // documentation: "mean(data)↵↵Return the sample arithmetic mean of data.↵↵>>> mean([1, 2, 3, 4, 4])↵2.8↵↵>>> from fractions import Fraction as F↵>>> mean([F(3, 7), F(1, 21), F(5, 3), F(1, 3)])↵Fraction(13, 21)↵↵>>> from decimal import Decimal as D↵>>> mean([D("0.5"), D("0.75"), D("0.625"), D("0.375")])↵Decimal('0.5625')↵↵If ``data`` is empty, StatisticsError will be raised."
      // insertText: "mean"
      // kind: 3
      // label: "mean(data)"
      // sortText: "amean"
      let text = match.insertText ? match.insertText : match.label;

      if (text.startsWith(token.value)) {
        all_non_prefixed = false;
      }

      matches.push(text);
      types.push({
        text: text,
        type: match.kind ? completionItemKindNames[match.kind] : ''
      });
    }

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
      end: token.offset + token.value.length,
      matches: matches,
      metadata: {
        _jupyter_types_experimental: types
      }
    };
  }

  private merge_replies(
    kernel: CompletionHandler.IReply,
    lsp: CompletionHandler.IReply,
    editor: CodeEditor.IEditor
  ) {
    // This is based on https://github.com/jupyterlab/jupyterlab/blob/f1bc02ced61881df94c49929837c49c022f5b115/packages/completer/src/connector.ts#L78
    // Copyright (c) Jupyter Development Team.
    // Distributed under the terms of the Modified BSD License.

    // If one is empty, return the other.
    if (kernel.matches.length === 0) {
      return lsp;
    } else if (lsp.matches.length === 0) {
      return kernel;
    }
    console.log('merging LSP and kernel completions:', lsp, kernel);

    // Populate the result with a copy of the lsp matches.
    const matches = lsp.matches.slice();
    const types = lsp.metadata._jupyter_types_experimental as Array<IItemType>;

    // Cache all the lsp matches in a memo.
    const memo = new Set<string>(matches);
    const memo_types = new Map<string, string>(
      types.map(v => [v.text, v.type])
    );

    let prefix = '';

    // if the kernel used a wider range, get the previous characters to strip the prefix off,
    // so that both use the same range
    if (lsp.start > kernel.start) {
      const cursor = editor.getCursorPosition();
      const line = editor.getLine(cursor.line);
      prefix = line.substring(kernel.start, kernel.end);
      console.log('will remove prefix from kernel response:', prefix);
    }

    let remove_prefix = (value: string) => {
      if (value.startsWith(prefix)) {
        return value.substr(prefix.length);
      }
      return value;
    };

    // TODO push the CompletionItem suggestion with proper sorting, this is a mess
    let priority_matches = new Set<string>();

    if (typeof kernel.metadata._jupyter_types_experimental !== 'undefined') {
      let kernel_types = kernel.metadata._jupyter_types_experimental as Array<
        IItemType
      >;
      kernel_types.forEach(itemType => {
        let text = remove_prefix(itemType.text);
        if (!memo_types.has(text)) {
          memo_types.set(text, itemType.type);
          if (itemType.type !== '<unknown>') {
            priority_matches.add(text);
          }
        }
      });
    }

    // Add each context match that is not in the memo to the result.
    kernel.matches.forEach(match => {
      match = remove_prefix(match);
      if (!memo.has(match) && !priority_matches.has(match)) {
        matches.push(match);
      }
    });

    let final_matches: Array<string> = Array.from(priority_matches).concat(
      matches
    );
    let merged_types: Array<IItemType> = Array.from(memo_types.entries()).map(
      ([key, value]) => ({ text: key, type: value })
    );

    return {
      ...lsp,
      matches: final_matches,
      metadata: {
        _jupyter_types_experimental: merged_types
      }
    };
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
    virtual_editor: VirtualEditor;
    /**
     * The connections to be used by the LSP connector.
     */
    connections: Map<VirtualDocument.id_path, LspWsConnection>;

    session?: IClientSession;
  }
}

interface IItemType extends ReadonlyJSONObject {
  // the item value
  text: string;
  // the item type
  type: string;
}
