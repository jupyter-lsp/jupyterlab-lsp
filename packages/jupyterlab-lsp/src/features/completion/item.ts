import { CompletionHandler } from '@jupyterlab/completer';
import { ILSPConnection } from '@jupyterlab/lsp';
import { LabIcon } from '@jupyterlab/ui-components';
import * as lsProtocol from 'vscode-languageserver-types';

/**
 * To be upstreamed
 */
export interface IExtendedCompletionItem
  extends CompletionHandler.ICompletionItem {
  insertText: string;
  sortText: string;
  source: string;
}

namespace CompletionItem {
  export interface IOptions {
    /**
     * Type of this completion item.
     */
    type: string;
    /**
     * LabIcon object for icon to be rendered with completion type.
     */
    icon: LabIcon | null;
    match: lsProtocol.CompletionItem;
    connection: ILSPConnection;
    source: string;
  }
}

export class CompletionItem implements IExtendedCompletionItem {
  /**
   * Self-reference to make sure that the instance for will remain accessible
   * after any copy operation (whether via spread syntax or Object.assign)
   * performed by the JupyterLab completer internals.
   */
  public self: CompletionItem;
  public element: HTMLLIElement;
  public source: string;

  get isDocumentationMarkdown(): boolean {
    return this._isDocumentationMarkdown;
  }

  /**
   * User facing completion.
   * If insertText is not set, this will be inserted.
   */
  public label: string;

  icon: LabIcon | undefined;

  constructor(protected options: CompletionItem.IOptions) {
    const match = options.match;
    this.label = match.label;
    this._setDocumentation(match.documentation);
    this._resolved = false;
    this._detail = match.detail;
    this._match = match;
    this.self = this;
    this.source = options.source;
    this.icon = options.icon ? options.icon : undefined;

    // Upstream is sometimes using spread operator to copy the object (in reconciliator),
    // which does not copy getters because these are not enumerable; we should use
    // `Object.assign` upstream, but them, but for now marking relevant properties as enumerable is enough
    // Ideally this would be fixed and tested e2e in JupyterLab 4.0.7.
    // https://github.com/jupyterlab/jupyterlab/issues/15125
    makeGetterEnumerable(this, 'insertText');
    makeGetterEnumerable(this, 'sortText');
    makeGetterEnumerable(this, 'filterText');
  }

  get type() {
    return this.options.type;
  }

  /**
   * Completion to be inserted.
   */
  get insertText(): string {
    return (
      this._currentInsertText || this._match.insertText || this._match.label
    );
  }
  set insertText(text: string) {
    this._currentInsertText = text;
  }

  get sortText(): string {
    return this._currentSortText || this._match.sortText || this._match.label;
  }
  set sortText(text: string) {
    this._currentSortText = text;
  }

  get filterText(): string | undefined {
    return this._match.filterText;
  }
  set filterText(text: string | undefined) {
    this._match.filterText = text;
  }

  get detail(): string | undefined {
    return this._detail;
  }

  public needsResolution(): boolean {
    if (this.documentation) {
      return false;
    }

    if (this._resolved) {
      return false;
    }

    return this._supportsResolution();
  }

  public isResolved() {
    return this._resolved;
  }

  /**
   * Resolve (fetch) details such as documentation.
   */
  public async resolve(): Promise<CompletionItem> {
    if (this._resolved) {
      return this;
    }
    if (!this._supportsResolution()) {
      return this;
    }

    const connection = this.options.connection;

    const resolvedCompletionItem = await connection.clientRequests[
      'completionItem/resolve'
    ].request(this._match);

    if (resolvedCompletionItem === null) {
      return this;
    }
    this._setDocumentation(resolvedCompletionItem?.documentation);
    this._detail = resolvedCompletionItem?.detail;
    // TODO: implement in pylsp and enable with proper LSP communication
    // this.label = resolvedCompletionItem.label;
    this._resolved = true;
    return this;
  }

  /**
   * A human-readable string with additional information
   * about this item, like type or symbol information.
   */
  get documentation(): string | undefined {
    if (this._documentation) {
      return this._documentation;
    }
    return undefined;
  }

  /**
   * Indicates if the item is deprecated.
   */
  get deprecated(): boolean {
    if (this._match.deprecated) {
      return this._match.deprecated;
    }
    return (
      this._match.tags != null &&
      this._match.tags.some(
        tag => tag == lsProtocol.CompletionItemTag.Deprecated
      )
    );
  }

  private _setDocumentation(
    documentation: string | lsProtocol.MarkupContent | undefined
  ) {
    if (lsProtocol.MarkupContent.is(documentation)) {
      this._documentation = documentation.value;
      this._isDocumentationMarkdown = documentation.kind === 'markdown';
    } else {
      this._documentation = documentation;
      this._isDocumentationMarkdown = false;
    }
  }

  private _supportsResolution(): boolean {
    const connection = this.options.connection;
    return (
      connection.serverCapabilities.completionProvider?.resolveProvider ?? false
    );
  }

  private _detail: string | undefined;
  private _documentation: string | undefined;
  private _isDocumentationMarkdown: boolean;
  private _resolved: boolean;
  private _currentInsertText: string;
  private _currentSortText: string;
  private _match: lsProtocol.CompletionItem;
}

function makeGetterEnumerable(instance: object, name: string) {
  const generatedDescriptor = findDescriptor(instance, name);
  Object.defineProperty(instance, name, {
    enumerable: true,
    get: generatedDescriptor.get,
    set: generatedDescriptor.set
  });
}

function findDescriptor(instance: object, name: string) {
  while (instance) {
    const desc = Object.getOwnPropertyDescriptor(instance, name);
    if (desc) {
      return desc;
    }
    instance = Object.getPrototypeOf(instance);
  }
  throw Error(`No ${name} descriptor found.`);
}
