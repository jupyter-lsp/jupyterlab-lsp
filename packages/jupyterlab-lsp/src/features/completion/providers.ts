import { ISessionContext } from '@jupyterlab/apputils';
import { CodeEditor } from '@jupyterlab/codeeditor';
import {
  ICompletionsReply,
  IExtendedCompletionItem,
  ICompletionRequest,
  CompletionTriggerKind,
  ICompletionContext,
  ICompletionProvider,
  KernelCompletionProvider,
  ICompleterRenderer,
  IKernelProviderSettings
} from '@krassowski/completion-manager';
import * as lsProtocol from 'vscode-languageserver-types';

import { CodeCompletion as LSPCompletionSettings } from '../../_completion';
import { LSPConnection } from '../../connection';
import { PositionConverter } from '../../converter';
import { FeatureSettings } from '../../feature';
import { CompletionItemKind } from '../../lsp';
import {
  IEditorPosition,
  IRootPosition,
  IVirtualPosition
} from '../../positioning';
import { ILSPLogConsole } from '../../tokens';
import { VirtualDocument } from '../../virtual/document';
import { IVirtualEditor } from '../../virtual/editor';

import { LazyCompletionItem } from './item';

export class LSPCompletionProvider implements ICompletionProvider {
  identifier = 'lsp-completion-provider';
  renderer: ICompleterRenderer<LazyCompletionItem>;
  virtualEditor: IVirtualEditor<CodeEditor.IEditor>;
  connections: Map<VirtualDocument.uri, LSPConnection>;

  private _console: ILSPLogConsole;
  private _isDisposed = false;

  async isApplicable(request: ICompletionRequest, context: ICompletionContext) {
    // const location = get_positions(this.virtualEditor, context.editor);
    // TODO: allow to disable LSP completer for specific languages using this method maybe?
    return true;
  }

  get should_show_documentation(): boolean {
    return this.options.settings.composite.showDocumentation;
  }

  /**
   * Create a new LSP connector for completion requests.
   *
   * @param options - The instantiation options for the LSP connector.
   */
  constructor(protected options: LSPCompletionProvider.IOptions) {
    this.renderer = options.renderer;
    this._console = options.console;
  }

  dispose() {
    if (this._isDisposed) {
      return;
    }
    this.connections = null;
    this.options = null;
    this._isDisposed = true;
  }

  public get_connection(uri: string) {
    return this.connections.get(uri);
  }

  async fetch(
    request: ICompletionRequest,
    context: ICompletionContext
  ): Promise<ICompletionsReply> {
    const location = get_positions(this.virtualEditor, context.editor);

    const { document, token } = location;
    const { start, end, cursor } = location.virtual;

    let connection = this.get_connection(document.uri);

    this._console.debug('Fetching');
    this._console.debug('Token:', token, start, end);

    const trigger_kind =
      request.triggerKind == CompletionTriggerKind.AutoInvoked
        ? CompletionTriggerKind.Invoked
        : request.triggerKind;

    let lspCompletionItems = ((await connection.getCompletion(
      cursor,
      {
        start,
        end,
        text: token.value
      },
      document.document_info,
      false,
      location.typedCharacter,
      trigger_kind
    )) || []) as lsProtocol.CompletionItem[];

    this._console.debug('Transforming');
    let prefix = token.value.slice(0, location.positionInToken + 1);
    let all_non_prefixed = true;
    let items: IExtendedCompletionItem[] = [];
    lspCompletionItems.forEach(match => {
      let kind = match.kind ? CompletionItemKind[match.kind] : '';
      let completionItem = new LazyCompletionItem(
        kind,
        // todo: make sure it is writable0
        null,
        match,
        this,
        document.uri
      );

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
    this._console.debug('Transformed');
    // required to make the repetitive trigger characters like :: or ::: work for R with R languageserver,
    // see https://github.com/krassowski/jupyterlab-lsp/issues/436
    let prefix_offset = token.value.length;
    // completion of dictionaries for Python with jedi-language-server was
    // causing an issue for dic['<tab>'] case; to avoid this let's make
    // sure that prefix.length >= prefix.offset
    if (all_non_prefixed && prefix_offset > prefix.length) {
      prefix_offset = prefix.length;
    }

    let response = {
      // note in the ContextCompleter it was:
      // start: token.offset,
      // end: token.offset + token.value.length,
      // which does not work with "from statistics import <tab>" as the last token ends at "t" of "import",
      // so the completer would append "mean" as "from statistics importmean" (without space!);
      // (in such a case the typedCharacters is undefined as we are out of range)
      // a different workaround would be to prepend the token.value prefix:
      // text = token.value + text;
      // but it did not work for "from statistics <tab>" and lead to "from statisticsimport" (no space)
      start: token.offset + (all_non_prefixed ? prefix_offset : 0),
      end: token.offset + prefix.length,
      items: items,
      source: {
        name: 'LSP',
        priority: 2
      }
    };
    if (response.start > response.end) {
      console.warn(
        'Response contains start beyond end; this should not happen!',
        response
      );
    }

    return response;
  }
}

/**
 * A namespace for LSP connector statics.
 */
export namespace LSPCompletionProvider {
  /**
   * The instantiation options for cell completion handlers.
   */
  export interface IOptions {
    /**
     * The connections to be used by the LSP connector.
     */
    settings: FeatureSettings<LSPCompletionSettings>;
    console: ILSPLogConsole;
    renderer: ICompleterRenderer<LazyCompletionItem>;
  }
}

export interface ILocationTuple<T> {
  start: T;
  end: T;
  cursor: T;
}

export interface ICompletionLocation {
  document: VirtualDocument;
  editor: ILocationTuple<CodeEditor.IPosition>;
  virtual: ILocationTuple<IVirtualPosition>;
  root: ILocationTuple<IRootPosition>;
  token: CodeEditor.IToken;
  positionInToken: number;
  typedCharacter: string;
}

function transform_from_editor_to_root(
  virtualEditor: IVirtualEditor<any>,
  editor: CodeEditor.IEditor,
  position: CodeEditor.IPosition
): IRootPosition {
  let editor_position = PositionConverter.ce_to_cm(position) as IEditorPosition;
  return virtualEditor.transform_from_editor_to_root(editor, editor_position);
}

// Mixin to get the document from
function get_positions(
  virtualEditor: IVirtualEditor<any>,
  editor: CodeEditor.IEditor
): ICompletionLocation {
  const cursor = editor.getCursorPosition();
  const token = editor.getTokenForPosition(cursor);

  const start = editor.getPositionAt(token.offset);
  const end = editor.getPositionAt(token.offset + token.value.length);

  let position_in_token = cursor.column - start.column - 1;
  const typed_character = token.value[cursor.column - start.column - 1];

  let start_in_root = transform_from_editor_to_root(
    virtualEditor,
    editor,
    start
  );
  let end_in_root = transform_from_editor_to_root(virtualEditor, editor, end);
  let cursor_in_root = transform_from_editor_to_root(
    virtualEditor,
    editor,
    cursor
  );

  // find document for position
  let document = virtualEditor.document_at_root_position(start_in_root);

  return {
    document: document,
    virtual: {
      start: virtualEditor.root_position_to_virtual_position(start_in_root),
      end: virtualEditor.root_position_to_virtual_position(end_in_root),
      cursor: virtualEditor.root_position_to_virtual_position(cursor_in_root)
    },
    root: {
      start: start_in_root,
      end: end_in_root,
      cursor: cursor_in_root
    },
    editor: {
      start: start,
      end: end,
      cursor: cursor
    },
    token: token,
    positionInToken: position_in_token,
    typedCharacter: typed_character
  };
}

export class LSPKernelCompletionProvider extends KernelCompletionProvider {
  // to be set by public setter
  virtualEditor: IVirtualEditor<CodeEditor.IEditor>;

  private _kernelLanguage: string;
  // note: do NOT merge with _previousSession (two different "caches")
  private _previousSessionContext: ISessionContext;

  constructor(settings: IKernelProviderSettings) {
    super(settings);
    this._kernelLanguage = null;
    this._previousSessionContext = null;
  }

  async isApplicable(
    request: ICompletionRequest,
    context: ICompletionContext
  ): Promise<boolean> {
    let applicable = super.isApplicable(request, context);
    if (!applicable) {
      return false;
    }

    if (this._previousSessionContext != context.sessionContext) {
      this._kernelLanguage = (
        await context.sessionContext.session.kernel.info
      ).language_info.name;
      this._previousSessionContext = context.sessionContext;
    }

    const location = get_positions(this.virtualEditor, context.editor);

    return location.document.language === this._kernelLanguage;
  }
}
