import {
  ILSPCompletionThemeManager,
  KernelKind
} from '@jupyter-lsp/completion-theme';
import {
  ContextCompleterProvider,
  KernelCompleterProvider,
  CompletionHandler,
  ICompletionContext
} from '@jupyterlab/completer';
import { IDocumentWidget } from '@jupyterlab/docregistry';
import {
  ILSPDocumentConnectionManager,
  IEditorPosition
} from '@jupyterlab/lsp';
import { LabIcon } from '@jupyterlab/ui-components';

import { CodeCompletion as LSPCompletionSettings } from '../../_completion';
import {
  editorPositionToRootPosition,
  PositionConverter,
  documentAtRootPosition
} from '../../converter';
import { FeatureSettings } from '../../feature';

interface IOptions {
  settings: FeatureSettings<LSPCompletionSettings>;
  iconsThemeManager: ILSPCompletionThemeManager;
  connectionManager: ILSPDocumentConnectionManager;
}

export class EnhancedContextCompleterProvider extends ContextCompleterProvider {
  readonly label = 'context';

  constructor(protected options: IOptions) {
    super();
  }

  async fetch(
    request: CompletionHandler.IRequest,
    context: ICompletionContext
  ): Promise<CompletionHandler.ICompletionItemsReply> {
    const result = await super.fetch(request, context);
    result.items = result.items.map((item, order) => {
      return {
        ...item,
        icon: this.iconFor(item.type ?? 'Text') ?? this.iconFor('Text'),
        type: item.type === '<unknown>' ? undefined : (item.type as string),
        sortText: String.fromCharCode(order),
        source: this.label
      };
    });
    return result;
  }

  protected iconFor(type: string): LabIcon | undefined {
    const icon = this.options.iconsThemeManager.getIcon(type) as LabIcon | null;
    return icon ? icon : undefined;
  }
}

export class EnhancedKernelCompleterProvider extends KernelCompleterProvider {
  readonly label = 'kernel';

  constructor(protected options: IOptions) {
    super();
  }

  async fetch(
    request: CompletionHandler.IRequest,
    context: ICompletionContext
  ): Promise<CompletionHandler.ICompletionItemsReply> {
    const result = await super.fetch(request, context);
    result.items = result.items.map((item, order) => {
      return {
        ...item,
        icon: this.iconFor(item.type ?? KernelKind) ?? this.iconFor(KernelKind),
        sortText: String.fromCharCode(order),
        source: this.label
      };
    });
    return result;
  }

  async isApplicable(context: ICompletionContext): Promise<boolean> {
    // Note: this method logs errors instead of throwing to ensure we do not ever
    // break the upstream kernel completer, even if there is an error elsewhere.
    const upstream = await super.isApplicable(context);

    if (upstream === false) {
      return false;
    }

    const manager = this.options.connectionManager;
    const widget = context.widget as IDocumentWidget;
    if (typeof widget.context === 'undefined') {
      // there is no path for Console as it is not a DocumentWidget
      return upstream;
    }
    const adapter = manager.adapters.get(widget.context.path);

    if (!adapter) {
      return upstream;
    }

    if (!context.editor) {
      // TODO: why is editor optional in the first place?
      console.error('No editor');
      return upstream;
    }
    const editor = context.editor;

    const editorPosition = PositionConverter.ce_to_cm(
      editor.getCursorPosition()
    ) as IEditorPosition;

    const block = adapter.editors.find(
      value => value.ceEditor.getEditor() == editor
    );

    if (!block) {
      console.error('Could not get block with editor');
      return upstream;
    }
    const rootPosition = editorPositionToRootPosition(
      adapter,
      block.ceEditor,
      editorPosition
    );

    if (!rootPosition) {
      console.error('Could not get root position');
      return upstream;
    }
    const virtualDocument = documentAtRootPosition(adapter, rootPosition);
    return virtualDocument === adapter.virtualDocument;
  }

  protected iconFor(type: string): LabIcon | undefined {
    const icon = this.options.iconsThemeManager.getIcon(type) as LabIcon | null;
    return icon ? icon : undefined;
  }
}
