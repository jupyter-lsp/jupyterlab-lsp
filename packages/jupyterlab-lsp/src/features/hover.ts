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
  IRootPosition,
  IVirtualPosition,
  IEditorPosition,
  ProtocolCoordinates,
  ILSPFeatureManager,
  isEqual,
  ILSPDocumentConnectionManager,
  WidgetLSPAdapter,
  VirtualDocument,
  Document
} from '@jupyterlab/lsp';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { LabIcon } from '@jupyterlab/ui-components';
import { Throttler } from '@lumino/polling';
import type * as lsProtocol from 'vscode-languageserver-protocol';

import hoverSvg from '../../style/icons/hover.svg';
import { CodeHover as LSPHoverSettings, ModifierKey } from '../_hover';
import { EditorTooltipManager, FreeTooltip } from '../components/free_tooltip';
import { ContextAssembler } from '../context';
import {
  PositionConverter,
  documentAtRootPosition,
  rootPositionToVirtualPosition,
  rootPositionToEditorPosition,
  editorPositionToRootPosition,
  editorAtRootPosition,
  rangeToEditorRange,
  IEditorRange
} from '../converter';
import { FeatureSettings, Feature } from '../feature';
import { createMarkManager, ISimpleMarkManager } from '../marks';
import { PLUGIN_ID } from '../tokens';
import { getModifierState } from '../utils';
import { BrowserConsole } from '../virtual/console';

export const hoverIcon = new LabIcon({
  name: 'lsp:hover',
  svgstr: hoverSvg
});

interface IResponseData {
  response: lsProtocol.Hover;
  document: VirtualDocument;
  editorRange: IEditorRange;
  ceEditor: CodeEditor.IEditor;
}

/**
 * Check whether mouse is close to given element (within a specified number of pixels)
 * @param what target element
 * @param who mouse event determining position and target
 * @param cushion number of pixels on each side defining "closeness" boundary
 */
function isCloseTo(what: HTMLElement, who: MouseEvent, cushion = 50): boolean {
  const target = who.type === 'mouseleave' ? who.relatedTarget : who.target;

  if (what === target || what.contains(target as HTMLElement)) {
    return true;
  }
  const whatRect = what.getBoundingClientRect();
  return !(
    who.x < whatRect.left - cushion ||
    who.x > whatRect.right + cushion ||
    who.y < whatRect.top - cushion ||
    who.y > whatRect.bottom + cushion
  );
}

class ResponseCache {
  protected _data: Array<IResponseData>;
  get data() {
    return this._data;
  }

  constructor(public maxSize: number) {
    this._data = [];
  }

  store(item: IResponseData) {
    const previousIndex = this._data.findIndex(
      previous =>
        previous.document === item.document &&
        isEqual(previous.editorRange.start, item.editorRange.start) &&
        isEqual(previous.editorRange.end, item.editorRange.end) &&
        previous.editorRange.editor === item.editorRange.editor
    );
    if (previousIndex !== -1) {
      this._data[previousIndex] = item;
      return;
    }

    if (this._data.length >= this.maxSize) {
      this._data.shift();
    }
    this._data.push(item);
  }

  clean() {
    this._data = [];
  }
}

function toMarkup(
  content: string | lsProtocol.MarkedString
): lsProtocol.MarkupContent {
  if (typeof content === 'string') {
    // coerce deprecated MarkedString to an MarkupContent; if given as a string it is markdown too,
    // quote: "It is either a markdown string or a code-block that provides a language and a code snippet."
    // (https://microsoft.github.io/language-server-protocol/specifications/specification-3-17/#markedString)
    return {
      kind: 'markdown',
      value: content
    };
  } else {
    return {
      kind: 'markdown',
      value: '```' + content.language + '\n' + content.value + '\n```'
    };
  }
}

interface IContext {
  adapter: WidgetLSPAdapter<any>;
  token: CodeEditor.IToken;
  editor: CodeEditor.IEditor;
  editorAccessor: Document.IEditor;
}

export class HoverFeature extends Feature {
  readonly capabilities: lsProtocol.ClientCapabilities = {
    textDocument: {
      hover: {
        dynamicRegistration: true,
        contentFormat: ['markdown', 'plaintext']
      }
    }
  };
  readonly id = HoverFeature.id;
  tooltipManager: EditorTooltipManager;

  protected console = new BrowserConsole().scope('Hover');
  protected settings: FeatureSettings<LSPHoverSettings>;
  protected lastHoverCharacter: IRootPosition | null = null;
  private lastHoverResponse: lsProtocol.Hover | null;
  protected hasMarker: boolean = false;
  protected markManager: ISimpleMarkManager<'hover'>;
  private virtualPosition: IVirtualPosition;
  protected cache: ResponseCache;
  protected contextAssembler: ContextAssembler;

  private debouncedGetHover: Throttler<
    Promise<lsProtocol.Hover | null>,
    void,
    [VirtualDocument, IVirtualPosition, IContext]
  >;
  private tooltip: FreeTooltip;
  private _previousHoverRequest: Promise<
    Promise<lsProtocol.Hover | null>
  > | null = null;

  constructor(options: HoverFeature.IOptions) {
    super(options);
    this.settings = options.settings;
    this.tooltipManager = new EditorTooltipManager(options.renderMimeRegistry);
    this.contextAssembler = options.contextAssembler;

    this.cache = new ResponseCache(10);
    const connectionManager = options.connectionManager;

    this.markManager = createMarkManager({
      hover: { class: 'cm-lsp-hover-available' }
    });

    options.editorExtensionRegistry.addExtension({
      name: 'lsp:hover',
      factory: options => {
        const updateListener = EditorView.updateListener.of(viewUpdate => {
          if (viewUpdate.docChanged) {
            this.afterChange();
          }
        });
        const eventListeners = EditorView.domEventHandlers({
          mousemove: event => {
            const adapter = [...connectionManager.adapters.values()].find(
              adapter =>
                adapter.widget.node.contains(event.target as HTMLElement)
            );

            if (!adapter) {
              this.console.warn('Adapter not found');
              return;
            }

            // this is used to hide the tooltip on leaving cells in notebook
            this.updateUnderlineAndTooltip(event, adapter)
              ?.then(keepTooltip => {
                if (!keepTooltip) {
                  this.maybeHideTooltip(event);
                }
              })
              .catch(this.console.warn);
          },
          mouseleave: event => {
            this.onMouseLeave(event);
          },
          // show hover after pressing the modifier key
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
            this.onKeyDown(event, adapter);
          }
        });
        return EditorExtensionRegistry.createImmutableExtension([
          eventListeners,
          updateListener
        ]);
      }
    });

    this.debouncedGetHover = this.createThrottler();

    this.settings.changed.connect(() => {
      this.cache.maxSize = this.settings.composite.cacheSize;
      this.debouncedGetHover = this.createThrottler();
    });
  }

  protected createThrottler() {
    return new Throttler<
      Promise<lsProtocol.Hover | null>,
      void,
      [VirtualDocument, IVirtualPosition, IContext]
    >(this.getHover, {
      limit: this.settings.composite.throttlerDelay || 0,
      edge: 'trailing'
    });
  }

  protected get modifierKey(): ModifierKey {
    return this.settings.composite.modifierKey;
  }

  protected get isHoverAutomatic(): boolean {
    return this.settings.composite.autoActivate;
  }

  protected restoreFromCache(
    document: VirtualDocument,
    virtualPosition: IVirtualPosition
  ): IResponseData | null {
    const { line, ch } = virtualPosition;
    const matchingItems = this.cache.data.filter(cacheItem => {
      if (cacheItem.document !== document) {
        return false;
      }
      let range = cacheItem.response.range!;
      return ProtocolCoordinates.isWithinRange({ line, character: ch }, range);
    });
    if (matchingItems.length > 1) {
      this.console.warn(
        'Potential hover cache malfunction: ',
        virtualPosition,
        matchingItems
      );
    }
    return matchingItems.length != 0 ? matchingItems[0] : null;
  }

  protected onKeyDown = (
    event: KeyboardEvent,
    adapter: WidgetLSPAdapter<any>
  ) => {
    if (
      getModifierState(event, this.modifierKey) &&
      this.lastHoverCharacter !== null
    ) {
      // does not need to be shown if it is already visible (otherwise we would be creating an identical tooltip again!)
      if (this.tooltip && this.tooltip.isVisible && !this.tooltip.isDisposed) {
        return;
      }
      const document = documentAtRootPosition(adapter, this.lastHoverCharacter);
      let responseData = this.restoreFromCache(document, this.virtualPosition);
      if (responseData == null) {
        return;
      }
      event.stopPropagation();
      this.handleResponse(adapter, responseData, this.lastHoverCharacter, true);
    }
  };

  protected onMouseLeave = (event: MouseEvent) => {
    this.removeRangeHighlight();
    this.maybeHideTooltip(event);
  };

  protected maybeHideTooltip(mouseEvent: MouseEvent) {
    if (
      typeof this.tooltip !== 'undefined' &&
      !isCloseTo(this.tooltip.node, mouseEvent)
    ) {
      this.tooltip.dispose();
    }
  }

  afterChange() {
    // reset cache on any change in the document
    this.cache.clean();
    this.lastHoverCharacter = null;
    this.removeRangeHighlight();
  }

  protected getHover = async (
    virtualDocument: VirtualDocument,
    virtualPosition: IVirtualPosition,
    context: IContext
  ): Promise<lsProtocol.Hover | null> => {
    const connection = this.connectionManager.connections.get(
      virtualDocument.uri
    )!;
    if (!(connection.isReady && connection.serverCapabilities.hoverProvider)) {
      return null;
    }
    let response = await connection.clientRequests[
      'textDocument/hover'
    ].request({
      textDocument: {
        uri: virtualDocument.documentInfo.uri
      },
      position: {
        line: virtualPosition.line,
        character: virtualPosition.ch
      }
    });

    if (response == null) {
      return null;
    }

    if (typeof response.range !== 'undefined') {
      return response;
    }
    // Harmonise response by adding range
    const editorRange = this._getEditorRange(
      context.adapter,
      response,
      context.token,
      context.editor
    );
    return this._addRange(
      context.adapter,
      response,
      editorRange,
      context.editorAccessor
    );
  };

  protected static getMarkupForHover(
    response: lsProtocol.Hover
  ): lsProtocol.MarkupContent {
    let contents = response.contents;

    if (typeof contents === 'string') {
      contents = [contents as lsProtocol.MarkedString];
    }

    if (!Array.isArray(contents)) {
      return contents as lsProtocol.MarkupContent;
    }

    let markups = contents.map(toMarkup);
    if (markups.every(markup => markup.kind == 'plaintext')) {
      return {
        kind: 'plaintext',
        value: markups.map(markup => markup.value).join('\n')
      };
    } else {
      return {
        kind: 'markdown',
        value: markups.map(markup => markup.value).join('\n\n')
      };
    }
  }

  /**
   * marks the word if a tooltip is available.
   * Displays tooltip if asked to do so.
   *
   * Returns true is the tooltip was shown.
   */
  public handleResponse = (
    adapter: WidgetLSPAdapter<any>,
    responseData: IResponseData,
    rootPosition: IRootPosition,
    showTooltip: boolean
  ): boolean => {
    let response = responseData.response;

    // testing for object equality because the response will likely be reused from cache
    if (this.lastHoverResponse != response) {
      this.removeRangeHighlight();

      const range = responseData.editorRange;
      const editorView = (range.editor as CodeMirrorEditor).editor;
      const from = range.editor.getOffsetAt(
        PositionConverter.cm_to_ce(range.start)
      );
      const to = range.editor.getOffsetAt(
        PositionConverter.cm_to_ce(range.end)
      );
      this.markManager.putMarks(editorView, [{ from, to, kind: 'hover' }]);
      this.hasMarker = true;
    }

    this.lastHoverResponse = response;

    if (showTooltip) {
      const markup = HoverFeature.getMarkupForHover(response);
      let editorPosition = rootPositionToEditorPosition(adapter, rootPosition);

      this.tooltip = this.tooltipManager.showOrCreate({
        markup,
        position: editorPosition,
        ceEditor: responseData.ceEditor,
        adapter: adapter,
        className: 'lsp-hover'
      });
      return true;
    }
    return false;
  };

  protected isTokenEmpty(token: CodeEditor.IToken) {
    return token.value.length === 0;
    // TODO  || token.type.length === 0? (sometimes the underline is shown on meaningless tokens)
  }

  protected isEventInsideVisible(event: MouseEvent) {
    let target = event.target as HTMLElement;
    return target.closest('.cm-scroller') != null;
  }

  protected isResponseUseful(response: lsProtocol.Hover) {
    return (
      response &&
      response.contents &&
      !(Array.isArray(response.contents) && response.contents.length === 0)
    );
  }

  /**
   * Returns true if the tooltip should stay.
   */
  protected async _updateUnderlineAndTooltip(
    event: MouseEvent,
    adapter: WidgetLSPAdapter<any>
  ): Promise<boolean> {
    const target = event.target;

    // if over an empty space in a line (and not over a token) then not worth checking
    if (
      target == null
      // TODO this no longer works in CodeMirror6 as it tires to avoid wrapping
      // html elements as much as possible.
      // || (target as HTMLElement).classList.contains('cm-line')
    ) {
      this.removeRangeHighlight();
      return false;
    }

    const showTooltip =
      this.isHoverAutomatic || getModifierState(event, this.modifierKey);

    // Filtering is needed to determine in hovered character belongs to this virtual document

    // TODO: or should the adapter be derived from model and passed as an argument? Or maybe we should try both?
    // const adapter = this.contextAssembler.adapterFromNode(target as HTMLElement);

    if (!adapter) {
      this.removeRangeHighlight();
      return false;
    }

    const rootPosition = this.contextAssembler.positionFromCoordinates(
      event.clientX,
      event.clientY,
      adapter
    );

    // happens because mousemove is attached to panel, not individual code cells,
    // and because some regions of the editor (between lines) have no characters
    if (rootPosition == null) {
      this.removeRangeHighlight();
      return false;
    }

    const editorAccessor = editorAtRootPosition(adapter, rootPosition);
    const editor = editorAccessor.getEditor();
    if (!editor) {
      this.console.warn('Editor not available from accessor');
      this.removeRangeHighlight();
      return false;
    }

    const editorPosition = rootPositionToEditorPosition(adapter, rootPosition);

    const offset = editor.getOffsetAt(
      PositionConverter.cm_to_ce(editorPosition)
    );
    const token = editor.getTokenAt(offset);

    const document = documentAtRootPosition(adapter, rootPosition);

    if (
      this.isTokenEmpty(token) ||
      //document !== this.virtualDocument ||
      !this.isEventInsideVisible(event)
    ) {
      this.removeRangeHighlight();
      return false;
    }

    if (
      !this.lastHoverCharacter ||
      !isEqual(rootPosition, this.lastHoverCharacter)
    ) {
      let virtualPosition = rootPositionToVirtualPosition(
        adapter,
        rootPosition
      );
      this.virtualPosition = virtualPosition;
      this.lastHoverCharacter = rootPosition;

      // if we already sent a request, maybe it already covers the are of interest?
      // not harm waiting as the server won't be able to help us anyways
      if (this._previousHoverRequest) {
        await Promise.race([
          this._previousHoverRequest,
          // just in case if the request stalled, set a timeout so we do not
          // get stuck indefinitely
          new Promise(resolve => {
            return setTimeout(resolve, 1000);
          })
        ]);
      }
      let responseData = this.restoreFromCache(document, virtualPosition);
      let delayMilliseconds = this.settings.composite.delay;

      if (responseData == null) {
        //const ceEditor =
        //  editorAtRootPosition(adapter, rootPosition).getEditor()!;
        const promise = this.debouncedGetHover.invoke(
          document,
          virtualPosition,
          {
            adapter,
            token,
            editor,
            editorAccessor
          }
        );
        this._previousHoverRequest = promise;
        let response = await promise;
        if (this._previousHoverRequest === promise) {
          this._previousHoverRequest = null;
        }
        if (
          response &&
          response.range &&
          ProtocolCoordinates.isWithinRange(
            { line: virtualPosition.line, character: virtualPosition.ch },
            response.range
          ) &&
          this.isResponseUseful(response)
        ) {
          // TODO: I am reconstructing the range anyways - do I really want to ensure it in getHover?
          const editorRange = this._getEditorRange(
            adapter,
            response,
            token,
            editor
          );
          responseData = {
            response: response,
            document: document,
            editorRange: editorRange,
            ceEditor: editor
          };

          this.cache.store(responseData);
          delayMilliseconds = Math.max(
            0,
            this.settings.composite.delay -
              this.settings.composite.throttlerDelay
          );
        } else {
          this.removeRangeHighlight();
          return false;
        }
      }

      if (this.isHoverAutomatic) {
        await new Promise(resolve => setTimeout(resolve, delayMilliseconds));
      }

      return this.handleResponse(
        adapter,
        responseData,
        rootPosition,
        showTooltip
      );
    } else {
      return true;
    }
  }

  protected updateUnderlineAndTooltip = (
    event: MouseEvent,
    adapter: WidgetLSPAdapter<any>
  ) => {
    try {
      return this._updateUnderlineAndTooltip(event, adapter);
    } catch (e) {
      this.console.warn(e);
      return undefined;
    }
  };

  protected removeRangeHighlight = () => {
    if (this.hasMarker) {
      this.markManager.clearAllMarks();
      this.hasMarker = false;
      this.lastHoverResponse = null;
      this.lastHoverCharacter = null;
    }
  };

  remove(): void {
    this.cache.clean();
    this.removeRangeHighlight();
    this.debouncedGetHover.dispose();
  }

  /**
   * Construct the range to underline manually using the token information.
   */
  private _getEditorRange(
    adapter: WidgetLSPAdapter<any>,
    response: lsProtocol.Hover,
    token: CodeEditor.IToken,
    editor: CodeEditor.IEditor
  ): IEditorRange {
    if (typeof response.range !== 'undefined') {
      return rangeToEditorRange(adapter, response.range, editor);
    }

    const startInEditor = editor.getPositionAt(token.offset);
    const endInEditor = editor.getPositionAt(token.offset + token.value.length);

    if (!startInEditor || !endInEditor) {
      throw Error(
        'Could not reconstruct editor range: start or end of token in editor do not resolve to a position'
      );
    }

    return {
      start: PositionConverter.ce_to_cm(startInEditor) as IEditorPosition,
      end: PositionConverter.ce_to_cm(endInEditor) as IEditorPosition,
      editor
    };
  }

  private _addRange(
    adapter: WidgetLSPAdapter<any>,
    response: lsProtocol.Hover,
    editorEange: IEditorRange,
    editorAccessor: Document.IEditor
  ): lsProtocol.Hover {
    return {
      ...response,
      range: {
        start: PositionConverter.cm_to_lsp(
          rootPositionToVirtualPosition(
            adapter,
            editorPositionToRootPosition(
              adapter,
              editorAccessor,
              editorEange.start
            )!
          )
        ),
        end: PositionConverter.cm_to_lsp(
          rootPositionToVirtualPosition(
            adapter,
            editorPositionToRootPosition(
              adapter,
              editorAccessor,
              editorEange.end
            )!
          )
        )
      }
    };
  }
}

export namespace HoverFeature {
  export interface IOptions extends Feature.IOptions {
    settings: FeatureSettings<LSPHoverSettings>;
    renderMimeRegistry: IRenderMimeRegistry;
    editorExtensionRegistry: IEditorExtensionRegistry;
    contextAssembler: ContextAssembler;
  }
  export const id = PLUGIN_ID + ':hover';
}

export const HOVER_PLUGIN: JupyterFrontEndPlugin<void> = {
  id: HoverFeature.id,
  requires: [
    ILSPFeatureManager,
    ISettingRegistry,
    IRenderMimeRegistry,
    IEditorExtensionRegistry,
    ILSPDocumentConnectionManager
  ],
  autoStart: true,
  activate: async (
    app: JupyterFrontEnd,
    featureManager: ILSPFeatureManager,
    settingRegistry: ISettingRegistry,
    renderMimeRegistry: IRenderMimeRegistry,
    editorExtensionRegistry: IEditorExtensionRegistry,
    connectionManager: ILSPDocumentConnectionManager
  ) => {
    const contextAssembler = new ContextAssembler({ app, connectionManager });
    const settings = new FeatureSettings<LSPHoverSettings>(
      settingRegistry,
      HoverFeature.id
    );
    await settings.ready;
    if (settings.composite.disable) {
      return;
    }
    const feature = new HoverFeature({
      settings,
      renderMimeRegistry,
      editorExtensionRegistry,
      connectionManager,
      contextAssembler
    });
    featureManager.register(feature);
  }
};
