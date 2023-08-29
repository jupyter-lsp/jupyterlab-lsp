import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { IEditorExtensionRegistry } from '@jupyterlab/codemirror';
import { DocumentRegistry, IDocumentWidget } from '@jupyterlab/docregistry';
import { IEditorTracker, FileEditor } from '@jupyterlab/fileeditor';
import {
  ILSPFeatureManager,
  ILSPDocumentConnectionManager,
  WidgetLSPAdapter,
  VirtualDocument
} from '@jupyterlab/lsp';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import {
  ITableOfContentsRegistry,
  TableOfContents,
  TableOfContentsModel,
  TableOfContentsFactory
} from '@jupyterlab/toc';
import { Throttler } from '@lumino/polling';
import { Widget } from '@lumino/widgets';
import type * as lsProtocol from 'vscode-languageserver-protocol';

import { CodeSymbols as LSPSymbolSettings } from '../_symbol';
import { ContextAssembler } from '../context';
import { FeatureSettings, Feature } from '../feature';
import { SymbolTag } from '../lsp';
import { PLUGIN_ID } from '../tokens';
import { BrowserConsole } from '../virtual/console';

/**
 * Interface describing a LSP heading.
 */
interface IEditorHeading extends TableOfContents.IHeading {
  /**
   * LSP symbol data.
   */
  symbol: lsProtocol.DocumentSymbol;
}

/**
 * Table of content model using LSP.
 */
class LSPTableOfContentsModel extends TableOfContentsModel<
  IEditorHeading,
  IDocumentWidget<FileEditor, DocumentRegistry.IModel>
> {
  constructor(
    protected widget: IDocumentWidget<FileEditor, DocumentRegistry.IModel>,
    protected symbolFeature: SymbolFeature,
    protected connectionManager: ILSPDocumentConnectionManager,
    configuration?: TableOfContents.IConfig
  ) {
    super(widget, configuration);
  }

  /**
   * Type of document supported by the model.
   *
   * #### Notes
   * A `data-document-type` attribute with this value will be set
   * on the tree view `.jp-TableOfContents-content[data-document-type="..."]`
   */
  get documentType(): string {
    return 'lsp';
  }

  /**
   * List of configuration options supported by the model.
   */
  get supportedOptions(): (keyof TableOfContents.IConfig)[] {
    return ['maximalDepth', 'numberHeaders'];
  }

  /**
   * Produce the headings for a document.
   *
   * @returns The list of new headings or `null` if nothing needs to be updated.
   */
  protected async getHeadings(): Promise<IEditorHeading[] | null> {
    if (!this.isActive) {
      return null;
    }

    const adapter = [...this.connectionManager.adapters.values()].find(
      adapter => adapter.widget.node.contains(this.widget.node)
    );
    if (!adapter?.virtualDocument) {
      return null;
    }

    const headings = new Array<IEditorHeading>();

    const symbols = await this.symbolFeature.getSymbols.invoke(
      adapter,
      adapter.virtualDocument
    );
    if (!symbols) {
      return null;
    }

    const processBreadthFirst = (
      elements: lsProtocol.DocumentSymbol[],
      level = 1
    ) => {
      for (const symbol of elements) {
        headings.push({
          text: symbol.name,
          level,
          symbol
        });
        if (symbol.children) {
          processBreadthFirst(symbol.children, level + 1);
        }
      }
    };
    processBreadthFirst(symbols);

    return headings;
  }
}

class LSPEditorTableOfContentsFactory extends TableOfContentsFactory<
  IDocumentWidget<FileEditor>,
  IEditorHeading
> {
  constructor(
    tracker: IEditorTracker,
    protected symbolFeature: SymbolFeature,
    protected connectionManager: ILSPDocumentConnectionManager
  ) {
    super(tracker);
  }
  /**
   * Whether the factory can handle the widget or not.
   *
   * @param widget - widget
   * @returns boolean indicating a ToC can be generated
   */
  isApplicable(widget: Widget): boolean {
    const isApplicable = super.isApplicable(widget);

    if (isApplicable) {
      return this.symbolFeature.isApplicable(widget);
    }
    return false;
  }

  /**
   * Create a new table of contents model for the widget
   *
   * @param widget - widget
   * @param configuration - Table of contents configuration
   * @returns The table of contents model
   */
  createNew(
    widget: IDocumentWidget<FileEditor, DocumentRegistry.IModel>,
    configuration?: TableOfContents.IConfig
  ): TableOfContentsModel<
    IEditorHeading,
    IDocumentWidget<FileEditor, DocumentRegistry.IModel>
  > {
    const model = super.createNew(widget, configuration);

    const onActiveHeadingChanged = (
      model: TableOfContentsModel<
        IEditorHeading,
        IDocumentWidget<FileEditor, DocumentRegistry.IModel>
      >,
      heading: IEditorHeading | null
    ) => {
      if (heading) {
        widget.content.editor.setCursorPosition({
          line: heading.symbol.selectionRange.start.line,
          column: heading.symbol.selectionRange.start.character
        });
      }
    };

    model.activeHeadingChanged.connect(onActiveHeadingChanged);
    widget.disposed.connect(() => {
      model.activeHeadingChanged.disconnect(onActiveHeadingChanged);
    });

    return model;
  }

  /**
   * Create a new table of contents model for the widget
   *
   * @param widget - widget
   * @param configuration - Table of contents configuration
   * @returns The table of contents model
   */
  protected _createNew(
    widget: IDocumentWidget<FileEditor, DocumentRegistry.IModel>,
    configuration?: TableOfContents.IConfig
  ): LSPTableOfContentsModel {
    return new LSPTableOfContentsModel(
      widget,
      this.symbolFeature,
      this.connectionManager,
      configuration
    );
  }
}
function isSymbolInformationArray(
  response: lsProtocol.DocumentSymbol[] | lsProtocol.SymbolInformation[]
): response is lsProtocol.SymbolInformation[] {
  return (
    response.length > 0 &&
    !!(response[0] as lsProtocol.SymbolInformation).location
  );
}

export class SymbolFeature extends Feature {
  readonly capabilities: lsProtocol.ClientCapabilities = {
    textDocument: {
      documentSymbol: {
        dynamicRegistration: true,
        tagSupport: {
          valueSet: [SymbolTag.Deprecated]
        },
        hierarchicalDocumentSymbolSupport: true
      }
    }
  };
  readonly id = SymbolFeature.id;

  protected console = new BrowserConsole().scope('Symbol');
  protected settings: FeatureSettings<LSPSymbolSettings>;
  protected cache: WeakMap<WidgetLSPAdapter<any>, lsProtocol.DocumentSymbol>;
  protected contextAssembler: ContextAssembler;
  public getSymbols: Throttler<
    lsProtocol.DocumentSymbol[] | null,
    void,
    [WidgetLSPAdapter<any>, VirtualDocument]
  >;

  constructor(options: SymbolFeature.IOptions) {
    super(options);
    this.settings = options.settings;
    this.contextAssembler = options.contextAssembler;
    const { tocRegistry, editorTracker } = options;
    this.connectionManager = options.connectionManager;

    if (tocRegistry && editorTracker) {
      tocRegistry.add(
        new LSPEditorTableOfContentsFactory(
          editorTracker,
          this,
          this.connectionManager
        )
      );
    }

    this.cache = new WeakMap();

    this.getSymbols = this.createThrottler();

    this.settings.changed.connect(() => {
      this.getSymbols = this.createThrottler();
    });
  }

  isApplicable(widget: Widget): boolean {
    const adapter = [...this.connectionManager.adapters.values()].find(
      adapter => adapter.widget.node.contains(widget.node)
    );
    if (!adapter?.virtualDocument) {
      return false;
    }
    const connection = this.connectionManager.connections.get(
      adapter.virtualDocument.uri
    )!;

    if (
      !(
        connection.isReady &&
        connection.serverCapabilities.documentSymbolProvider
      )
    ) {
      return false;
    }
    return true;
  }

  protected createThrottler() {
    return new Throttler<
      lsProtocol.DocumentSymbol[] | null,
      void,
      [WidgetLSPAdapter<any>, VirtualDocument]
    >(this._getSymbols.bind(this), {
      limit: this.settings.composite.throttlerDelay || 0,
      edge: 'trailing'
    });
  }

  private async _getSymbols(
    adapter: WidgetLSPAdapter<any>,
    virtualDocument: VirtualDocument
  ): Promise<lsProtocol.DocumentSymbol[] | null> {
    // TODO: return from cache
    await adapter.ready;

    const connection = this.connectionManager.connections.get(
      virtualDocument.uri
    )!;

    if (
      !(
        connection.isReady &&
        connection.serverCapabilities.documentSymbolProvider
      )
    ) {
      return null;
    }

    // for popup use
    // 'workspace/symbol'

    const response = await connection.clientRequests[
      'textDocument/documentSymbol'
    ].request({
      textDocument: {
        uri: virtualDocument.documentInfo.uri
      }
    });
    // TODO: for some reason after reloading JupyterLab server errors out
    // unless a file in project gets opened. This may indicate that open
    // notifications are not sent out properly.
    return this._handleSymbols(response);
  }

  private _handleSymbols(
    response:
      | lsProtocol.DocumentSymbol[]
      | lsProtocol.SymbolInformation[]
      | null
  ): lsProtocol.DocumentSymbol[] | null {
    if (!response) {
      return null;
    }
    if (isSymbolInformationArray(response)) {
      return response.map(s => {
        return {
          name: s.name,
          kind: s.kind,
          tags: s.tags,
          deprecated: s.deprecated,
          range: s.location.range,
          selectionRange: s.location.range
        };
      });
    }
    return response;
  }
}

export namespace SymbolFeature {
  export interface IOptions extends Feature.IOptions {
    settings: FeatureSettings<LSPSymbolSettings>;
    renderMimeRegistry: IRenderMimeRegistry;
    editorExtensionRegistry: IEditorExtensionRegistry;
    contextAssembler: ContextAssembler;
    tocRegistry: ITableOfContentsRegistry | null;
    editorTracker: IEditorTracker | null;
  }
  export const id = PLUGIN_ID + ':symbol';
}

export const SYMBOL_PLUGIN: JupyterFrontEndPlugin<void> = {
  id: SymbolFeature.id,
  requires: [
    ILSPFeatureManager,
    ISettingRegistry,
    IRenderMimeRegistry,
    IEditorExtensionRegistry,
    ILSPDocumentConnectionManager
  ],
  optional: [ITableOfContentsRegistry, IEditorTracker],
  autoStart: true,
  activate: async (
    app: JupyterFrontEnd,
    featureManager: ILSPFeatureManager,
    settingRegistry: ISettingRegistry,
    renderMimeRegistry: IRenderMimeRegistry,
    editorExtensionRegistry: IEditorExtensionRegistry,
    connectionManager: ILSPDocumentConnectionManager,
    tocRegistry: ITableOfContentsRegistry | null,
    editorTracker: IEditorTracker | null
  ) => {
    const contextAssembler = new ContextAssembler({ app, connectionManager });
    const settings = new FeatureSettings<LSPSymbolSettings>(
      settingRegistry,
      PLUGIN_ID + ':hover'
      //   SymbolFeature.id
    );
    await settings.ready;
    if (settings.composite.disable) {
      return;
    }
    const feature = new SymbolFeature({
      settings,
      renderMimeRegistry,
      editorExtensionRegistry,
      connectionManager,
      contextAssembler,
      tocRegistry,
      editorTracker
    });
    featureManager.register(feature);
  }
};
