import { StateField, StateEffect } from '@codemirror/state';
import { EditorView, Decoration, DecorationSet } from '@codemirror/view';
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
import { ContextAssembler } from '../command_manager';
import { EditorTooltipManager, FreeTooltip } from '../components/free_tooltip';
import {
  PositionConverter,
  documentAtRootPosition,
  rootPositionToVirtualPosition,
  rootPositionToEditorPosition,
  editorPositionToRootPosition,
  editorAtRootPosition,
  virtualPositionToRootPosition
} from '../converter';
import { IEditorRange } from '../editor_integration/codemirror';
import { FeatureSettings, Feature } from '../feature';
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
  editor_range: IEditorRange;
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
        isEqual(previous.editor_range.start, item.editor_range.start) &&
        isEqual(previous.editor_range.end, item.editor_range.end) &&
        previous.editor_range.editor === item.editor_range.editor
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

function to_markup(
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

/**
 * Manage marks in multiple editor views (e.g. cells).
 */
interface ISimpleMarkManager {
  putMark(view: EditorView, from: number, to: number): void;
  /**
   * Clear marks from all editor views.
   */
  clearAllMarks(): void;
}

type MarkDecorationSpec = Parameters<typeof Decoration.mark>[0] & {
  class: string;
};

function createMarkManager(spec: MarkDecorationSpec): ISimpleMarkManager {
  const hoverMark = Decoration.mark(spec);

  const addHoverMark = StateEffect.define<{ from: number; to: number }>({
    map: ({ from, to }, change) => ({
      from: change.mapPos(from),
      to: change.mapPos(to)
    })
  });

  const removeHoverMark = StateEffect.define<null>();

  const hoverMarkField = StateField.define<DecorationSet>({
    create() {
      return Decoration.none;
    },
    update(marks, tr) {
      marks = marks.map(tr.changes);
      for (let e of tr.effects) {
        if (e.is(addHoverMark)) {
          marks = marks.update({
            add: [hoverMark.range(e.value.from, e.value.to)]
          });
        } else if (e.is(removeHoverMark)) {
          marks = marks.update({
            filter: (from, to, value) => {
              return value.spec['class'] !== spec.class;
            }
          });
        }
      }
      return marks;
    },
    provide: f => EditorView.decorations.from(f)
  });
  const views = new Set<EditorView>();

  return {
    putMark(view: EditorView, from: number, to: number) {
      const effects: StateEffect<unknown>[] = [addHoverMark.of({ from, to })];

      if (!view.state.field(hoverMarkField, false)) {
        effects.push(StateEffect.appendConfig.of([hoverMarkField]));
      }
      view.dispatch({ effects });
      views.add(view);
    },
    clearAllMarks() {
      for (let view of views) {
        const effects: StateEffect<unknown>[] = [removeHoverMark.of(null)];
        view.dispatch({ effects });
      }
      views.clear();
    }
  };
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
  private last_hover_response: lsProtocol.Hover | null;
  protected hasMarker: boolean = false;
  protected markManager: ISimpleMarkManager;
  private virtualPosition: IVirtualPosition;
  protected cache: ResponseCache;
  protected contextAssembler: ContextAssembler;

  private debounced_get_hover: Throttler<Promise<lsProtocol.Hover | null>>;
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

    this.markManager = createMarkManager({ class: 'cm-lsp-hover-available' });

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
              ?.then(keep_tooltip => {
                if (!keep_tooltip) {
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

    this.debounced_get_hover = this.create_throttler();

    this.settings.changed.connect(() => {
      this.cache.maxSize = this.settings.composite.cacheSize;
      this.debounced_get_hover = this.create_throttler();
    });
  }

  protected get modifierKey(): ModifierKey {
    return this.settings.composite.modifierKey;
  }

  protected get isHoverAutomatic(): boolean {
    return this.settings.composite.autoActivate;
  }

  protected restore_from_cache(
    document: VirtualDocument,
    virtualPosition: IVirtualPosition
  ): IResponseData | null {
    const { line, ch } = virtualPosition;
    const matching_items = this.cache.data.filter(cache_item => {
      if (cache_item.document !== document) {
        return false;
      }
      let range = cache_item.response.range!;
      return ProtocolCoordinates.isWithinRange({ line, character: ch }, range);
    });
    if (matching_items.length > 1) {
      this.console.warn(
        'Potential hover cache malfunction: ',
        virtualPosition,
        matching_items
      );
    }
    return matching_items.length != 0 ? matching_items[0] : null;
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
      let responseData = this.restore_from_cache(
        document,
        this.virtualPosition
      );
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

  protected create_throttler() {
    return new Throttler<Promise<lsProtocol.Hover | null>>(this.onHover, {
      limit: this.settings.composite.throttlerDelay || 0,
      edge: 'trailing'
    });
  }

  afterChange() {
    // reset cache on any change in the document
    this.cache.clean();
    this.lastHoverCharacter = null;
    this.removeRangeHighlight();
  }

  protected onHover = async (
    virtualDocument: VirtualDocument,
    virtualPosition: IVirtualPosition,
    add_range_fn: (hover: lsProtocol.Hover) => lsProtocol.Hover
  ): Promise<lsProtocol.Hover | null> => {
    const connection = this.connectionManager.connections.get(
      virtualDocument.uri
    )!;
    if (
      !(
        connection.isReady &&
        // @ts-ignore TODO remove once upstream fix released
        connection.serverCapabilities?.hoverProvider
      )
    ) {
      return null;
    }
    let hover = await connection.clientRequests['textDocument/hover'].request({
      textDocument: {
        uri: virtualDocument.documentInfo.uri
      },
      position: {
        line: virtualPosition.line,
        character: virtualPosition.ch
      }
    });

    if (hover == null) {
      return null;
    }

    return add_range_fn(hover);
  };

  protected static get_markup_for_hover(
    response: lsProtocol.Hover
  ): lsProtocol.MarkupContent {
    let contents = response.contents;

    if (typeof contents === 'string') {
      contents = [contents as lsProtocol.MarkedString];
    }

    if (!Array.isArray(contents)) {
      return contents as lsProtocol.MarkupContent;
    }

    let markups = contents.map(to_markup);
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
    if (this.last_hover_response != response) {
      this.removeRangeHighlight();

      const range = responseData.editor_range;
      const editorView = (range.editor as CodeMirrorEditor).editor;
      this.markManager.putMark(
        editorView,
        range.editor.getOffsetAt(PositionConverter.cm_to_ce(range.start)),
        range.editor.getOffsetAt(PositionConverter.cm_to_ce(range.end))
      );
      this.hasMarker = true;
    }

    this.last_hover_response = response;

    if (showTooltip) {
      const markup = HoverFeature.get_markup_for_hover(response);
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

  protected is_token_empty(token: CodeEditor.IToken) {
    return token.value.length === 0;
    // TODO  || token.type.length === 0? (sometimes the underline is shown on meaningless tokens)
  }

  protected is_event_inside_visible(event: MouseEvent) {
    let target = event.target as HTMLElement;
    return target.closest('.cm-scroller') != null;
  }

  protected is_useful_response(response: lsProtocol.Hover) {
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
      this.is_token_empty(token) ||
      //document !== this.virtualDocument ||
      !this.is_event_inside_visible(event)
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
      let responseData = this.restore_from_cache(document, virtualPosition);
      let delay_ms = this.settings.composite.delay;

      if (responseData == null) {
        //const ceEditor =
        //  editorAtRootPosition(adapter, rootPosition).getEditor()!;
        const add_range_fn = (hover: lsProtocol.Hover): lsProtocol.Hover => {
          const editor_range = this.get_editor_range(
            adapter,
            hover,
            rootPosition,
            token,
            editor
          );
          return this.add_range_if_needed(
            adapter,
            hover,
            editor_range,
            editorAccessor
          );
        };

        const promise = this.debounced_get_hover.invoke(
          document,
          virtualPosition,
          add_range_fn
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
          this.is_useful_response(response)
        ) {
          const editor_range = this.get_editor_range(
            adapter,
            response,
            rootPosition,
            token,
            editor
          );
          responseData = {
            response: response,
            document: document,
            editor_range: editor_range,
            ceEditor: editor
          };

          this.cache.store(responseData);
          delay_ms = Math.max(
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
        await new Promise(resolve => setTimeout(resolve, delay_ms));
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
      this.last_hover_response = null;
      this.lastHoverCharacter = null;
    }
  };

  remove(): void {
    this.cache.clean();
    this.removeRangeHighlight();
    this.debounced_get_hover.dispose();
  }

  range_to_editor_range(
    adapter: WidgetLSPAdapter<any>,
    range: lsProtocol.Range,
    editor: CodeEditor.IEditor
  ): IEditorRange {
    let start = PositionConverter.lsp_to_cm(range.start) as IVirtualPosition;
    let end = PositionConverter.lsp_to_cm(range.end) as IVirtualPosition;

    let startInRoot = virtualPositionToRootPosition(adapter, start);
    if (!startInRoot) {
      throw Error('Could not determine position in root');
    }

    if (editor == null) {
      let editorAccessor = editorAtRootPosition(adapter, startInRoot);
      const candidate = editorAccessor.getEditor();
      if (!candidate) {
        throw Error('Editor could not be accessed');
      }
      editor = candidate;
    }

    const document = documentAtRootPosition(adapter, startInRoot);

    return {
      start: document.transformVirtualToEditor(start)!,
      end: document.transformVirtualToEditor(end)!,
      editor: editor
    };
  }

  private get_editor_range(
    adapter: WidgetLSPAdapter<any>,
    response: lsProtocol.Hover,
    position: IRootPosition,
    token: CodeEditor.IToken,
    cm_editor: CodeEditor.IEditor
  ): IEditorRange {
    if (typeof response.range !== 'undefined') {
      return this.range_to_editor_range(adapter, response.range, cm_editor);
    }

    // construct the range manually using the token information
    let startInRoot = {
      line: position.line,
      ch: token.offset
    } as IRootPosition;
    let endInRoot = {
      line: position.line,
      ch: token.offset + token.value.length
    } as IRootPosition;

    return {
      start: rootPositionToEditorPosition(adapter, startInRoot),
      end: rootPositionToEditorPosition(adapter, endInRoot),
      editor: cm_editor
    };
  }

  private add_range_if_needed(
    adapter: WidgetLSPAdapter<any>,
    response: lsProtocol.Hover,
    editor_range: IEditorRange,
    editorAccessor: Document.IEditor
  ): lsProtocol.Hover {
    if (typeof response.range !== 'undefined') {
      return response;
    }
    return {
      ...response,
      range: {
        start: PositionConverter.cm_to_lsp(
          rootPositionToVirtualPosition(
            adapter,
            editorPositionToRootPosition(
              adapter,
              editorAccessor,
              editor_range.start
            )!
          )
        ),
        end: PositionConverter.cm_to_lsp(
          rootPositionToVirtualPosition(
            adapter,
            editorPositionToRootPosition(
              adapter,
              editorAccessor,
              editor_range.end
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
