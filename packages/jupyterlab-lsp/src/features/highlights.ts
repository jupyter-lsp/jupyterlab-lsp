import { EditorView } from '@codemirror/view';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { CodeEditor } from '@jupyterlab/codeeditor';
import {
  CodeMirrorEditor,
  IEditorExtensionRegistry,
  EditorExtensionRegistry
} from '@jupyterlab/codemirror';
import {
  IVirtualPosition,
  ILSPFeatureManager,
  IEditorPosition,
  ILSPDocumentConnectionManager,
  WidgetLSPAdapter,
  VirtualDocument
} from '@jupyterlab/lsp';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { LabIcon } from '@jupyterlab/ui-components';
import { Debouncer } from '@lumino/polling';
import type * as lsProtocol from 'vscode-languageserver-protocol';

import highlightSvg from '../../style/icons/highlight.svg';
import { CodeHighlights as LSPHighlightsSettings } from '../_highlights';
import { ContextAssembler } from '../command_manager';
import {
  PositionConverter,
  rootPositionToVirtualPosition,
  editorPositionToRootPosition,
  documentAtRootPosition,
  rangeToEditorRange
} from '../converter';
import { FeatureSettings, Feature } from '../feature';
import { DocumentHighlightKind } from '../lsp';
import { createMarkManager, ISimpleMarkManager } from '../marks';
import { PLUGIN_ID } from '../tokens';
import { BrowserConsole } from '../virtual/console';

export const highlightIcon = new LabIcon({
  name: 'lsp:highlight',
  svgstr: highlightSvg
});

interface IEditorHighlight {
  kind: DocumentHighlightKind;
  from: number;
  to: number;
}

export class HighlightsFeature extends Feature {
  readonly capabilities: lsProtocol.ClientCapabilities = {
    textDocument: {
      documentHighlight: {
        dynamicRegistration: true
      }
    }
  };
  readonly id = HighlightsFeature.id;

  protected settings: FeatureSettings<LSPHighlightsSettings>;
  protected markManager: ISimpleMarkManager<DocumentHighlightKind>;
  protected console = new BrowserConsole().scope('Highlights');

  private _debouncedGetHighlight: Debouncer<
    lsProtocol.DocumentHighlight[] | null,
    void,
    [VirtualDocument, IVirtualPosition]
  >;
  private _virtualPosition: IVirtualPosition;
  private _versionSent: number;
  private _lastToken: CodeEditor.IToken | null = null;

  constructor(options: HighlightsFeature.IOptions) {
    super(options);
    this.settings = options.settings;
    const connectionManager = options.connectionManager;
    this.markManager = createMarkManager({
      [DocumentHighlightKind.Text]: { class: 'cm-lsp-highlight-Text' },
      [DocumentHighlightKind.Read]: { class: 'cm-lsp-highlight-Read' },
      [DocumentHighlightKind.Write]: { class: 'cm-lsp-highlight-Write' }
    });

    this._debouncedGetHighlight = this.create_debouncer();

    this.settings.changed.connect(() => {
      this._debouncedGetHighlight = this.create_debouncer();
    });

    options.editorExtensionRegistry.addExtension({
      name: 'lsp:highlights',
      factory: options => {
        const updateListener = EditorView.updateListener.of(viewUpdate => {
          if (
            viewUpdate.docChanged ||
            viewUpdate.selectionSet ||
            viewUpdate.focusChanged
          ) {
            // TODO a better way to get the adapter here?
            const adapter = [...connectionManager.adapters.values()].find(
              adapter => adapter.widget.node.contains(viewUpdate.view.dom)
            );
            if (!adapter) {
              this.console.warn('Adapter not found');
              return;
            }
            this.onCursorActivity(adapter).catch(this.console.warn);
          }
        });
        const eventListeners = EditorView.domEventHandlers({
          blur: (e, view) => {
            this.onBlur(view);
          },
          focus: event => {
            const adapter = [...connectionManager.adapters.values()].find(
              adapter =>
                adapter.widget.node.contains(
                  event.currentTarget! as HTMLElement
                )
            );
            if (!adapter) {
              this.console.warn('Adapter not found');
              return;
            }
            this.onCursorActivity(adapter).catch(this.console.warn);
          },
          keydown: event => {
            const adapter = [...connectionManager.adapters.values()].find(
              adapter =>
                adapter.widget.node.contains(
                  event.currentTarget! as HTMLElement
                )
            );
            if (!adapter) {
              this.console.warn('Adapter not found');
              return;
            }
            this.onCursorActivity(adapter).catch(this.console.warn);
          }
        });
        return EditorExtensionRegistry.createImmutableExtension([
          updateListener,
          eventListeners
        ]);
      }
    });
  }

  protected onBlur(view: EditorView) {
    if (this.settings.composite.removeOnBlur) {
      this.markManager.clearEditorMarks(view);
      this._lastToken = null;
    }
  }

  protected handleHighlight(
    items: lsProtocol.DocumentHighlight[] | null,
    adapter: WidgetLSPAdapter<any>
  ) {
    this.markManager.clearAllMarks();

    if (!items) {
      return;
    }

    const highlightsByEditor = new Map<
      CodeEditor.IEditor,
      IEditorHighlight[]
    >();

    for (let item of items) {
      let range = rangeToEditorRange(adapter, item.range, null);
      const editor = range.editor;

      let optionsList = highlightsByEditor.get(editor);

      if (!optionsList) {
        optionsList = [];
        highlightsByEditor.set(editor, optionsList);
      }

      optionsList.push({
        kind: item.kind || DocumentHighlightKind.Text,
        from: editor.getOffsetAt(PositionConverter.cm_to_ce(range.start)),
        to: editor.getOffsetAt(PositionConverter.cm_to_ce(range.end))
      });
    }

    for (const [editor, markerDefinitions] of highlightsByEditor.entries()) {
      // CodeMirror5 performance test cases:
      //   - one cell with 1000 `math.pi` and `import math`; move cursor to `math`,
      //     wait for 1000 highlights, then move to `pi`:
      //     - step-by-step:
      //        - highlight `math`: 13.1s
      //        - then highlight `pi`: 16.6s
      //     - operation():
      //        - highlight `math`: 160ms
      //        - then highlight `pi`: 227ms
      //     - CodeMirror6, measuring `markManager.putMarks`:
      //        - highlight `math`: 181ms
      //        - then highlight `pi`: 334ms
      //   - 100 cells with `math.pi` and one with `import math`; move cursor to `math`,
      //     wait for 1000 highlights, then move to `pi` (this is overhead control,
      //     no gains expected):
      //     - step-by-step:
      //        - highlight `math`: 385ms
      //        - then highlight `pi`: 683 ms
      //     - operation():
      //        - highlight `math`: 390ms
      //        - then highlight `pi`: 870ms

      const editorView = (editor as CodeMirrorEditor).editor;
      this.markManager.putMarks(editorView, markerDefinitions);
    }
  }

  protected create_debouncer() {
    return new Debouncer<
      lsProtocol.DocumentHighlight[] | null,
      void,
      [VirtualDocument, IVirtualPosition]
    >(this.on_cursor_activity, this.settings.composite.debouncerDelay);
  }

  protected on_cursor_activity = async (
    virtualDocument: VirtualDocument,
    virtualPosition: IVirtualPosition
  ) => {
    const connection = this.connectionManager.connections.get(
      virtualDocument.uri
    )!;
    if (
      !(
        connection.isReady &&
        // @ts-ignore TODO remove once upstream fix released
        connection.serverCapabilities?.documentHighlightProvider
      )
    ) {
      return null;
    }
    this._versionSent = virtualDocument.documentInfo.version;
    return await connection.clientRequests[
      'textDocument/documentHighlight'
    ].request({
      textDocument: {
        uri: virtualDocument.documentInfo.uri
      },
      position: {
        line: virtualPosition.line,
        character: virtualPosition.ch
      }
    });
  };

  protected async onCursorActivity(adapter: WidgetLSPAdapter<any>) {
    if (!adapter.virtualDocument) {
      this.console.log('virtualDocument not ready on adapter');
      return;
    }
    await adapter.virtualDocument!.updateManager.updateDone;

    // TODO: this is the same problem as in signature
    // TODO: the assumption that updated editor = active editor will fail on RTC. How to get `CodeEditor.IEditor` and `Document.IEditor` from `EditorView`? we got `CodeEditor.IModel` from `options.model` but may need more context here.
    const editorAccessor = adapter.activeEditor;
    const editor = editorAccessor!.getEditor()!;
    const position = editor.getCursorPosition();
    const editorPosition = PositionConverter.ce_to_cm(
      position
    ) as IEditorPosition;

    const rootPosition = editorPositionToRootPosition(
      adapter,
      editorAccessor!,
      editorPosition
    );

    if (!rootPosition) {
      this.console.debug('Root position not available');
      return;
    }

    const document = documentAtRootPosition(adapter, rootPosition);

    if (!document.documentInfo) {
      this.console.debug('Root document lacks document info');
      return;
    }

    const offset = editor.getOffsetAt(
      PositionConverter.cm_to_ce(editorPosition)
    );
    const token = editor.getTokenAt(offset);

    // if token has not changed, no need to update highlight, unless it is an empty token
    // which would indicate that the cursor is at the first character
    if (
      this._lastToken &&
      token.value === this._lastToken.value &&
      token.value !== ''
    ) {
      this.console.log(
        'not requesting highlights (token did not change)',
        token
      );
      return;
    }

    try {
      const virtualPosition = rootPositionToVirtualPosition(
        adapter,
        rootPosition
      );
      this._virtualPosition = virtualPosition;

      const [highlights] = await Promise.all([
        // request the highlights as soon as possible
        this._debouncedGetHighlight.invoke(document, virtualPosition),
        // and in the meantime remove the old markers
        async () => {
          this.markManager.clearAllMarks();
          this._lastToken = null;
        }
      ]);

      // in the time the response returned the document might have been closed - check that
      if (document.isDisposed) {
        return;
      }

      let version_after = document.documentInfo.version;

      /// if document was updated since (e.g. user pressed delete - token change, but position did not)
      if (version_after !== this._versionSent) {
        this.console.log(
          'skipping highlights response delayed by ' +
            (version_after - this._versionSent) +
            ' document versions'
        );
        return;
      }
      // if cursor position changed (e.g. user moved cursor up - position has changed, but document version did not)
      if (virtualPosition !== this._virtualPosition) {
        this.console.log(
          'skipping highlights response: cursor moved since it was requested'
        );
        return;
      }

      this.handleHighlight(highlights, adapter);
      this._lastToken = token;
    } catch (e) {
      this.console.warn('Could not get highlights:', e);
    }
  }
}

export namespace HighlightsFeature {
  export interface IOptions extends Feature.IOptions {
    settings: FeatureSettings<LSPHighlightsSettings>;
    editorExtensionRegistry: IEditorExtensionRegistry;
    contextAssembler: ContextAssembler;
  }
  export const id = PLUGIN_ID + ':highlights';
}

export const HIGHLIGHTS_PLUGIN: JupyterFrontEndPlugin<void> = {
  id: HighlightsFeature.id,
  requires: [
    ILSPFeatureManager,
    ISettingRegistry,
    IEditorExtensionRegistry,
    ILSPDocumentConnectionManager
  ],
  autoStart: true,
  activate: async (
    app: JupyterFrontEnd,
    featureManager: ILSPFeatureManager,
    settingRegistry: ISettingRegistry,
    editorExtensionRegistry: IEditorExtensionRegistry,
    connectionManager: ILSPDocumentConnectionManager
  ) => {
    const contextAssembler = new ContextAssembler({ app, connectionManager });
    const settings = new FeatureSettings<LSPHighlightsSettings>(
      settingRegistry,
      HighlightsFeature.id
    );
    await settings.ready;
    const feature = new HighlightsFeature({
      settings,
      editorExtensionRegistry,
      connectionManager,
      contextAssembler
    });
    featureManager.register(feature);
  }
};
