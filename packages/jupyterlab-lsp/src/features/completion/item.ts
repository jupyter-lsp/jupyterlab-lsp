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
  private _detail: string | undefined;
  private _documentation: string | undefined;
  private _is_documentation_markdown: boolean;
  private _resolved: boolean;
  /**
   * Self-reference to make sure that the instance for will remain accessible
   * after any copy operation (whether via spread syntax or Object.assign)
   * performed by the JupyterLab completer internals.
   */
  public self: CompletionItem;
  public element: HTMLLIElement;
  public source: string;
  private _currentInsertText: string;

  get isDocumentationMarkdown(): boolean {
    return this._is_documentation_markdown;
  }

  /**
   * User facing completion.
   * If insertText is not set, this will be inserted.
   */
  public label: string;

  icon: LabIcon | undefined;
  private match: lsProtocol.CompletionItem;

  constructor(protected options: CompletionItem.IOptions) {
    const match = options.match;
    this.label = match.label;
    this._setDocumentation(match.documentation);
    this._resolved = false;
    this._detail = match.detail;
    this.match = match;
    this.self = this;
    this.source = options.source;
    this.icon = options.icon ? options.icon : undefined;
  }

  get type() {
    return this.options.type;
  }

  private _setDocumentation(
    documentation: string | lsProtocol.MarkupContent | undefined
  ) {
    if (lsProtocol.MarkupContent.is(documentation)) {
      this._documentation = documentation.value;
      this._is_documentation_markdown = documentation.kind === 'markdown';
    } else {
      this._documentation = documentation;
      this._is_documentation_markdown = false;
    }
  }

  /**
   * Completion to be inserted.
   */
  get insertText(): string {
    return this._currentInsertText || this.match.insertText || this.match.label;
  }

  set insertText(text: string) {
    this._currentInsertText = text;
  }

  get sortText(): string {
    return this.match.sortText || this.match.label;
  }

  get filterText(): string | undefined {
    return this.match.filterText;
  }

  private _supportsResolution(): boolean {
    const connection = this.options.connection;
    return (
      connection.serverCapabilities.completionProvider?.resolveProvider ?? false
    );
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
    ].request(this.match);

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
    if (this.match.deprecated) {
      return this.match.deprecated;
    }
    return (
      this.match.tags != null &&
      this.match.tags.some(
        tag => tag == lsProtocol.CompletionItemTag.Deprecated
      )
    );
  }
}
