import { ILSPCompletionThemeManager } from '@jupyter-lsp/completion-theme';
import { SourceChange } from '@jupyter/ydoc';
import { CodeEditor } from '@jupyterlab/codeeditor';
import {
  ICompletionProvider,
  CompletionHandler,
  ICompletionContext,
  Completer
} from '@jupyterlab/completer';
import { IDocumentWidget } from '@jupyterlab/docregistry';
import {
  ILSPDocumentConnectionManager,
  IEditorPosition
} from '@jupyterlab/lsp';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { LabIcon } from '@jupyterlab/ui-components';
import type * as lsProtocol from 'vscode-languageserver-protocol';

import { CodeCompletion as LSPCompletionSettings } from '../../_completion';
import {
  editorPositionToRootPosition,
  PositionConverter,
  documentAtRootPosition,
  rootPositionToVirtualPosition
} from '../../converter';
import { FeatureSettings } from '../../feature';
import { CompletionTriggerKind, CompletionItemKind } from '../../lsp';
import { ILSPLogConsole } from '../../tokens';
import { BrowserConsole } from '../../virtual/console';

import { CompletionItem } from './item';
import { LSPCompleterModel } from './model';
import { LSPCompletionRenderer } from './renderer';

interface IOptions {
  settings: FeatureSettings<LSPCompletionSettings>;
  renderMimeRegistry: IRenderMimeRegistry;
  iconsThemeManager: ILSPCompletionThemeManager;
  connectionManager: ILSPDocumentConnectionManager;
}

export class CompletionProvider implements ICompletionProvider<CompletionItem> {
  readonly identifier = 'lsp';
  readonly label = 'LSP';
  protected console = new BrowserConsole().scope('Completion provider');

  constructor(protected options: IOptions) {
    const markdownRenderer =
      options.renderMimeRegistry.createRenderer('text/markdown');

    this.renderer = new LSPCompletionRenderer({
      settings: options.settings,
      markdownRenderer,
      latexTypesetter: options.renderMimeRegistry.latexTypesetter,
      console: this.console
    });
  }

  renderer: LSPCompletionRenderer;

  modelFactory = async (
    context: ICompletionContext
  ): Promise<Completer.IModel> => {
    const composite = this.options.settings.composite;
    const model = new LSPCompleterModel({
      caseSensitive: composite.caseSensitive,
      preFilterMatches: composite.preFilterMatches,
      includePerfectMatches: composite.includePerfectMatches
    });
    this.options.settings.changed.connect(() => {
      const composite = this.options.settings.composite;
      model.settings.caseSensitive = composite.caseSensitive;
      model.settings.preFilterMatches = composite.preFilterMatches;
      model.settings.includePerfectMatches = composite.includePerfectMatches;
    });
    return model;
  };

  /**
   * Resolve (fetch) details such as documentation.
   */
  async resolve(completionItem: CompletionItem): Promise<any> {
    await completionItem.resolve();
    // expand getters
    return {
      label: completionItem.label,
      documentation: completionItem.documentation,
      deprecated: completionItem.deprecated,
      detail: completionItem.detail,
      filterText: completionItem.filterText,
      sortText: completionItem.sortText,
      insertText: completionItem.insertText,
      source: completionItem.source,
      type: completionItem.type,
      isDocumentationMarkdown: completionItem.isDocumentationMarkdown,
      icon: completionItem.icon
    };
  }

  shouldShowContinuousHint(
    completerIsVisible: boolean,
    changed: SourceChange,
    context?: ICompletionContext
  ): boolean {
    if (!context) {
      // waiting for https://github.com/jupyterlab/jupyterlab/pull/15015 due to
      // https://github.com/jupyterlab/jupyterlab/issues/15014
      return false;
      // throw Error('Completion context was expected');
    }

    const manager = this.options.connectionManager;
    const widget = context?.widget as IDocumentWidget;
    const adapter = manager.adapters.get(widget.context.path);
    if (!context.editor) {
      // TODO: why is editor optional in the first place?
      throw Error('No editor');
    }
    if (!adapter) {
      throw Error('No adapter');
    }
    const editor = context.editor;
    const editorPosition = PositionConverter.ce_to_cm(
      editor.getCursorPosition()
    ) as IEditorPosition;

    const block = adapter.editors.find(
      value => value.ceEditor.getEditor() == editor
    );

    if (!block) {
      throw Error('Could not get block with editor');
    }
    const rootPosition = editorPositionToRootPosition(
      adapter,
      block.ceEditor,
      editorPosition
    );

    if (!rootPosition) {
      throw Error('Could not get root position');
    }

    const virtualDocument = documentAtRootPosition(adapter, rootPosition);
    const connection = manager.connections.get(virtualDocument.uri);

    if (!connection) {
      throw Error('Could not find connection for virtual document');
    }

    const triggerCharacters =
      connection.serverCapabilities?.completionProvider?.triggerCharacters ||
      [];

    const sourceChange = changed.sourceChange;

    if (sourceChange == null) {
      return false;
    }

    if (sourceChange.some(delta => delta.delete != null)) {
      return false;
    }
    const token = editor.getTokenAtCursor();

    if (this.options.settings.composite.continuousHinting) {
      // if token type is known and not ignored token type is ignored - show completer
      if (
        token.type &&
        !this.options.settings.composite.suppressContinuousHintingIn.includes(
          token.type
        )
      ) {
        return true;
      }
      // otherwise show it may still be shown due to trigger character
    }
    if (
      !token.type ||
      this.options.settings.composite.suppressTriggerCharacterIn.includes(
        token.type
      )
    ) {
      return false;
    }

    return sourceChange.some(
      delta =>
        delta.insert != null &&
        (triggerCharacters.includes(delta.insert) ||
          (!completerIsVisible && delta.insert.trim().length > 0))
    );
  }

  async fetch(
    request: CompletionHandler.IRequest,
    context: ICompletionContext,
    trigger?: CompletionTriggerKind
  ): Promise<CompletionHandler.ICompletionItemsReply<CompletionItem>> {
    const manager = this.options.connectionManager;
    const widget = context.widget as IDocumentWidget;
    const adapter = manager.adapters.get(widget.context.path);

    if (!context.editor) {
      // TODO: why is editor optional in the first place?
      throw Error('No editor');
    }
    if (!adapter) {
      throw Error('No adapter');
    }
    const editor = context.editor;
    const editorPosition = PositionConverter.ce_to_cm(
      editor.getPositionAt(request.offset)!
    ) as IEditorPosition;
    const token = editor.getTokenAt(request.offset);
    const positionInToken = token.offset - request.offset;
    // TODO: (typedCharacter can serve as a proxy for triggerCharacter)
    const typedCharacter = token.value[positionInToken + 1];

    // TODO: direct mapping
    // because we need editorAccessor, not the editor itself we perform this rather sad dance:
    const block = adapter.editors.find(
      value => value.ceEditor.getEditor() == editor
    );
    if (!block) {
      throw Error('Could not get block with editor');
    }

    const rootPosition = editorPositionToRootPosition(
      adapter,
      block.ceEditor,
      editorPosition
    );

    if (!rootPosition) {
      throw Error('Could not get root position');
    }

    const virtualDocument = documentAtRootPosition(adapter, rootPosition);
    const virtualPosition = rootPositionToVirtualPosition(
      adapter,
      rootPosition
    );

    const connection = manager.connections.get(virtualDocument.uri);

    if (!connection) {
      throw Error('Could not find connection for virtual document');
    }

    const lspCompletionReply = await connection.clientRequests[
      'textDocument/completion'
    ].request({
      textDocument: {
        uri: virtualDocument.documentInfo.uri
      },
      position: {
        line: virtualPosition.line,
        character: virtualPosition.ch
      },
      context: {
        triggerKind: trigger || CompletionTriggerKind.Invoked,
        triggerCharacter:
          trigger === CompletionTriggerKind.TriggerCharacter
            ? typedCharacter
            : undefined
      }
    });

    const completionList =
      !lspCompletionReply || Array.isArray(lspCompletionReply)
        ? ({
            isIncomplete: false,
            items: lspCompletionReply || []
          } as lsProtocol.CompletionList)
        : lspCompletionReply;

    return transformLSPCompletions(
      token,
      positionInToken,
      completionList.items,
      (kind, match) => {
        return new CompletionItem({
          match,
          connection,
          type: kind,
          icon: this.options.iconsThemeManager.getIcon(kind) as LabIcon | null,
          source: this.label
        });
      },
      this.console
    );
  }

  async isApplicable(context: ICompletionContext): Promise<boolean> {
    if (this.options.settings.composite.disable) {
      return false;
    }
    /*
    // Disabled due to the result being effectively cached until user changes
    // cells which can lead to bad UX; upstream issue:
    // https://github.com/jupyterlab/jupyterlab/issues/15016
    const manager = this.options.connectionManager;
    const widget = context.widget as IDocumentWidget;
    const adapter = manager.adapters.get(widget.context.path);
    if (!adapter) {
      return false;
    }
    */
    return true;
  }
}
export function transformLSPCompletions<T>(
  token: CodeEditor.IToken,
  positionInToken: number,
  lspCompletionItems: lsProtocol.CompletionItem[],
  createCompletionItem: (kind: string, match: lsProtocol.CompletionItem) => T,
  console: ILSPLogConsole
) {
  let prefix = token.value.slice(0, positionInToken + 1);
  let allNonPrefixed = true;
  let items: T[] = [];
  lspCompletionItems.forEach(match => {
    let kind = match.kind ? CompletionItemKind[match.kind] : '';

    // Update prefix values
    let text = match.insertText ? match.insertText : match.label;

    // declare prefix presence if needed and update it
    if (text.toLowerCase().startsWith(prefix.toLowerCase())) {
      allNonPrefixed = false;
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
    // add prefix if needed
    else if (token.type === 'string' && prefix.includes('/')) {
      // special case for path completion in strings, ensuring that:
      //     '/Com<tab> → '/Completion.ipynb
      // when the returned insert text is `Completion.ipynb` (the token here is `'/Com`)
      // developed against pyls and pylsp server, may not work well in other cases
      const parts = prefix.split('/');
      if (
        text.toLowerCase().startsWith(parts[parts.length - 1].toLowerCase())
      ) {
        let pathPrefix = parts.slice(0, -1).join('/') + '/';
        match.insertText = pathPrefix + text;
        // for label removing the prefix quote if present
        if (pathPrefix.startsWith("'") || pathPrefix.startsWith('"')) {
          pathPrefix = pathPrefix.substr(1);
        }
        match.label = pathPrefix + match.label;
        allNonPrefixed = false;
      }
    }

    let completionItem = createCompletionItem(kind, match);

    items.push(completionItem);
  });
  console.debug('Transformed');
  // required to make the repetitive trigger characters like :: or ::: work for R with R languageserver,
  // see https://github.com/jupyter-lsp/jupyterlab-lsp/issues/436
  let prefixOffset = token.value.length;
  // completion of dictionaries for Python with jedi-language-server was
  // causing an issue for dic['<tab>'] case; to avoid this let's make
  // sure that prefix.length >= prefix.offset
  if (allNonPrefixed && prefixOffset > prefix.length) {
    prefixOffset = prefix.length;
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
    start: token.offset + (allNonPrefixed ? prefixOffset : 0),
    end: token.offset + prefix.length,
    items: items,
    source: 'LSP'
  };
  if (response.start > response.end) {
    console.warn(
      'Response contains start beyond end; this should not happen!',
      response
    );
  }
  return response;
}
