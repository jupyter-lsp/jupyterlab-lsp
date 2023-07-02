import {
  ILSPCompletionThemeManager,
  KernelKind
} from '@jupyter-lsp/completion-theme';
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
import { BrowserConsole } from '../../virtual/console';

import { CompletionItem } from './item';
import { LSPCompleterModel } from './model';
import { LSPCompletionRenderer } from './renderer';

interface IOptions {
  settings: FeatureSettings<LSPCompletionSettings>;
  renderMimeRegistry: IRenderMimeRegistry;
  iconsThemeManager: ILSPCompletionThemeManager;
  //editorExtensionRegistry: IEditorExtensionRegistry;
  connectionManager: ILSPDocumentConnectionManager;
}

export class CompletionProvider implements ICompletionProvider<CompletionItem> {
  readonly identifier = 'lsp';
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

  async modelFactory(context: ICompletionContext): Promise<Completer.IModel> {
    return new LSPCompleterModel({
      caseSensitive: this.options.settings.composite.caseSensitive,
      preFilterMatches: this.options.settings.composite.preFilterMatches,
      includePerfectMatches:
        this.options.settings.composite.includePerfectMatches
    });
  }
  // shouldShowContinuousHint

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
      type: completionItem.type,
      source: completionItem.source,
      isDocumentationMarkdown: completionItem.isDocumentationMarkdown,
      icon: completionItem.icon
    };
  }

  async fetch(
    request: CompletionHandler.IRequest,
    context: ICompletionContext
  ): Promise<CompletionHandler.ICompletionItemsReply<CompletionItem>> {
    this.console.log('will fetch');
    const manager = this.options.connectionManager;
    // TODO should widget be IDocumentWidget?
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

    //const triggerKind =
    //  this.trigger_kind == AdditionalCompletionTriggerKinds.AutoInvoked
    //    ? CompletionTriggerKind.Invoked
    //    : this.trigger_kind;

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
        triggerKind: CompletionTriggerKind.Invoked
        //triggerCharacter: (not should be undefined unless CompletionTriggerKind.TriggerCharacter)
      }
    });

    const completionList =
      !lspCompletionReply || Array.isArray(lspCompletionReply)
        ? ({
            isIncomplete: false,
            items: lspCompletionReply || []
          } as lsProtocol.CompletionList)
        : lspCompletionReply;

    return {
      start: request.offset,
      end: request.offset,
      items: completionList.items.map(match => {
        const type = match.kind ? CompletionItemKind[match.kind] : '';
        console.log('type', type, match.kind, this.iconFor(type));
        return new CompletionItem({
          match,
          connection,
          type,
          icon: this.iconFor(type),
          showDocumentation: this.options.settings.composite.showDocumentation
        });
      })
    };
  }

  protected iconFor(type: string): LabIcon {
    if (typeof type === 'undefined') {
      type = KernelKind;
    }
    return (
      (this.options.iconsThemeManager.get_icon(type) as LabIcon) || undefined
    );
  }

  async isApplicable(context: ICompletionContext): Promise<boolean> {
    return true;
  }
}
