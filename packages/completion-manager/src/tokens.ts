import { ISessionContext } from '@jupyterlab/apputils';
import { CodeEditor } from '@jupyterlab/codeeditor';
import { Completer, CompletionHandler } from '@jupyterlab/completer';
import { IDocumentWidget } from '@jupyterlab/docregistry';
import { LabIcon } from '@jupyterlab/ui-components';
import { Token } from '@lumino/coreutils';

import { GenericCompleterModel } from './model';

export const PLUGIN_ID = '@krassowski/completion-manager';

/**
 * Source of the completions (e.g. kernel, lsp, kite, snippets-extension, etc.)
 */
export interface ICompletionsSource {
  /**
   * The name displayed in the GUI
   */
  name: string;
  /**
   * The higher the number the higher the priority
   */
  priority: number;
  /**
   * The icon to be displayed if no type icon is present
   */
  fallbackIcon?: LabIcon;
}

export interface ICompletionProviderSettings {
  timeout: number;
  enabled: boolean;
}

/**
 * Source-aware and improved completion item
 */
export interface IExtendedCompletionItem
  extends CompletionHandler.ICompletionItem {
  insertText: string;
  sortText: string;
  source?: ICompletionsSource;
  /**
   * Provider will be added automatically.
   */
  provider?: ICompletionProvider;
  /**
   * Adding self-reference ensures that the original completion object can be accessed from the renderer.
   * It is recommended for providers to set self if objects are storing additional dynamic state,
   * e.g. by downloading documentation text asynchronously.
   */
  self?: IExtendedCompletionItem;
}

/**
 * Completion items reply from a specific source
 */
export interface ICompletionsReply<
  T extends IExtendedCompletionItem = IExtendedCompletionItem
> extends CompletionHandler.ICompletionItemsReply {
  // TODO: it is not clear when the source is set here and when on IExtendedCompletionItem.
  //  it might be good to separate the two stages for both interfaces
  /**
   * Source of the completions. A provider can be the source of completions,
   * but in general a provider can provide completions from multiple sources,
   * for example:
   *  - LSP can provide completions from multiple language servers for the same document.
   *  - A machine-learning-based completion provider may provide completions based on algorithm A and algorithm B
   */
  source: ICompletionsSource;
  items: T[];
}

export interface ICompletionContext {
  editor: CodeEditor.IEditor;
  widget: IDocumentWidget;
  // extracted from notebook widget as convenience:
  sessionContext?: ISessionContext;
}

export interface IIconSource {
  iconFor(completionType: string): LabIcon;
}

export interface ICompletionRequest extends CompletionHandler.IRequest {
  triggerKind: CompletionTriggerKind;
}

export interface ICompleterRenderer<T extends IExtendedCompletionItem>
  extends Completer.IRenderer {
  createCompletionItemNode(item: T, orderedTypes: string[]): HTMLLIElement;
  createDocumentationNode(item: T): HTMLElement;
}

export interface ICompletionProvider<
  T extends IExtendedCompletionItem = IExtendedCompletionItem
> {
  /**
   * Unique identifier of the provider
   */
  identifier: string;

  /**
   * Is completion provider applicable to specified context?
   * @param request - useful because we may want to disable specific sources in some parts of document (like sql code cell in a Python notebook)
   * @param context
   */
  isApplicable(
    request: ICompletionRequest,
    context: ICompletionContext
  ): Promise<boolean>;

  /**
   * Renderer for provider's completions (optional).
   */
  renderer?: ICompleterRenderer<T>;

  /**
   * Fetch completion requests.
   *
   * @param request - the completion request text and details
   * @param context - additional information about context of completion request
   */
  fetch(
    request: ICompletionRequest,
    context: ICompletionContext
  ): Promise<ICompletionsReply<T>>;

  // TODO: not functional yet
  /**
   * Given an incomplete (unresolved) completion item, resolve it by adding all missing details,
   * such as lazy-fetched documentation.
   *
   * @param completion - the completion item to resolve
   */
  resolve?(completion: T): Promise<T>;
}

enum LSPCompletionTriggerKind {
  Invoked = 1,
  TriggerCharacter = 2,
  TriggerForIncompleteCompletions = 3
}

enum AdditionalCompletionTriggerKinds {
  AutoInvoked = 9999
}

export const CompletionTriggerKind = {
  ...LSPCompletionTriggerKind,
  ...AdditionalCompletionTriggerKinds
};
export type CompletionTriggerKind =
  | LSPCompletionTriggerKind
  | AdditionalCompletionTriggerKinds;

export interface ICompletionProviderManager {
  registerProvider(provider: ICompletionProvider): void;

  getProvider(identifier: string): ICompletionProvider;

  overrideProvider(provider: ICompletionProvider): void;

  setIconSource(iconSource: IIconSource): void;

  invoke(trigger: CompletionTriggerKind): Promise<any>;

  // TODO?
  // unregister(provider: ICompletionProvider): void;

  connect(
    context: ICompletionContext,
    model: GenericCompleterModel<CompletionHandler.ICompletionItem>
  ): void;

  configure(settings: ICompletionSettings): void;
}

export const ICompletionProviderManager = new Token<ICompletionProviderManager>(
  PLUGIN_ID + ':ICompletionProviderManager'
);

export interface ICompletionSettings {
  providers: {
    [identifier: string]: ICompletionProviderSettings;
  };
  suppressContinuousHintingIn: string[];
  suppressTriggerCharacterIn: string[];
}
