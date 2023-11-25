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
  readonly rank = 1000;
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
      includePerfectMatches: composite.includePerfectMatches,
      kernelCompletionsFirst: composite.kernelCompletionsFirst
    });
    this.options.settings.changed.connect(() => {
      const composite = this.options.settings.composite;
      model.settings.caseSensitive = composite.caseSensitive;
      model.settings.preFilterMatches = composite.preFilterMatches;
      model.settings.includePerfectMatches = composite.includePerfectMatches;
      model.settings.kernelCompletionsFirst = composite.kernelCompletionsFirst;
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
    const positionInToken = request.offset - token.offset;
    // TODO: (typedCharacter can serve as a proxy for triggerCharacter)
    const typedCharacter = token.value[positionInToken - 1];

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
    const manager = this.options.connectionManager;
    const widget = context.widget as IDocumentWidget;
    if (typeof widget.context === 'undefined') {
      // there is no path for Console as it is not a DocumentWidget
      return false;
    }
    const adapter = manager.adapters.get(widget.context.path);
    if (!adapter) {
      return false;
    }
    return true;
  }
}

function stripQuotes(path: string): string {
  return path.slice(
    path.startsWith("'") || path.startsWith('"') ? 1 : 0,
    path.endsWith("'") || path.endsWith('"') ? -1 : path.length
  );
}
export function transformLSPCompletions<T>(
  token: CodeEditor.IToken,
  positionInToken: number,
  lspCompletionItems: lsProtocol.CompletionItem[],
  createCompletionItem: (kind: string, match: lsProtocol.CompletionItem) => T,
  console: ILSPLogConsole
) {
  let prefix = token.value.slice(0, positionInToken);
  let suffix = token.value.slice(positionInToken, token.value.length);
  let items: T[] = [];
  // If there are no prefixes, we will just insert the text without replacing the token,
  // which is the case for example in R for `stats::<tab>` which returns module members
  // without `::` prefix.
  // If there are prefixes, we will replace the token so we may need to prepend/append to,
  // or otherwise modify the insert text of individual completion items.
  let anyPrefixed = false;

  lspCompletionItems.forEach(match => {
    let kind = match.kind ? CompletionItemKind[match.kind] : '';

    let text = match.insertText ? match.insertText : match.label;
    let intendedText = match.insertText ? match.insertText : match.label;

    if (intendedText.toLowerCase().startsWith(prefix.toLowerCase())) {
      anyPrefixed = true;
    }

    // Add overlap with token prefix
    if (intendedText.startsWith(token.value)) {
      anyPrefixed = true;
      // remove overlap with prefix before expanding it
      if (intendedText.startsWith(prefix)) {
        text = text.substring(prefix.length, text.length);
        match.insertText = text;
      }
      text = token.value + text;
      match.insertText = text;
    }

    // special handling for paths
    if (token.type === 'String' && prefix.includes('/')) {
      const parts = stripQuotes(prefix).split('/');
      if (
        text.toLowerCase().startsWith(parts[parts.length - 1].toLowerCase())
      ) {
        let pathPrefix = parts.slice(0, -1).join('/') + '/';
        text =
          (prefix.startsWith("'") || prefix.startsWith('"') ? prefix[0] : '') +
          pathPrefix +
          text +
          (suffix.startsWith("'") || suffix.startsWith('"') ? suffix[0] : '');
        match.insertText = text;
        // for label without quotes
        match.label = pathPrefix + match.label;
        anyPrefixed = true;
      }
    } else {
      // harmonise end to token
      if (text.toLowerCase().endsWith(suffix.toLowerCase())) {
        text = text.substring(0, text.length - suffix.length);
        match.insertText = text;
      } else if (token.type === 'String') {
        // special case for completion in strings to preserve the closing quote;
        // there is an issue that this gives opposing results in Notebook vs File editor
        // probably due to reconciliator logic
        if (suffix.startsWith("'") || suffix.startsWith('"')) {
          match.insertText = text + suffix[0];
        }
      }
    }

    let completionItem = createCompletionItem(kind, match);

    items.push(completionItem);
  });
  console.debug('Transformed');

  let start = token.offset;
  let end = token.offset + token.value.length;
  if (!anyPrefixed) {
    start = end;
  }

  let response = {
    start,
    end,
    items,
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
