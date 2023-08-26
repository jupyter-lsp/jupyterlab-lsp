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
import { LabIcon } from '@jupyterlab/ui-components';

import { CodeCompletion as LSPCompletionSettings } from '../../_completion';
import { FeatureSettings } from '../../feature';

interface IOptions {
  settings: FeatureSettings<LSPCompletionSettings>;
  iconsThemeManager: ILSPCompletionThemeManager;
}

export class EnhancedContextCompleterProvider extends ContextCompleterProvider {
  readonly label = 'context';

  constructor(protected options: IOptions) {
    super();
  }

  private get _kernelCompletionsFirst(): boolean {
    return this.options.settings.composite.kernelCompletionsFirst;
  }

  async fetch(
    request: CompletionHandler.IRequest,
    context: ICompletionContext
  ): Promise<CompletionHandler.ICompletionItemsReply> {
    const result = await super.fetch(request, context);
    result.items = result.items.map(i => {
      return {
        ...i,
        icon: this.iconFor(i.type ?? 'Text') ?? this.iconFor('Text'),
        type: i.type === '<unknown>' ? undefined : (i.type as string),
        sortText: this._kernelCompletionsFirst ? 'a' : 'z',
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
    result.items = result.items.map(i => {
      return {
        ...i,
        icon: this.iconFor(i.type ?? KernelKind) ?? this.iconFor(KernelKind),
        sortText: 'z',
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
