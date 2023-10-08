import type { EditorView } from '@codemirror/view';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { CodeEditor } from '@jupyterlab/codeeditor';
import type { CodeMirrorEditor } from '@jupyterlab/codemirror';
import { IDocumentWidget } from '@jupyterlab/docregistry';
import {
  ILSPConnection,
  WidgetLSPAdapter,
  ILSPDocumentConnectionManager,
  IEditorPosition,
  IRootPosition,
  IVirtualPosition,
  Document
} from '@jupyterlab/lsp';

import {
  PositionConverter,
  documentAtRootPosition,
  rootPositionToVirtualPosition,
  editorPositionToRootPosition,
  editorAtRootPosition,
  rootPositionToEditorPosition
} from './converter';
import { BrowserConsole } from './virtual/console';
import { VirtualDocument } from './virtual/document';

// TODO: reconsider naming
export class ContextAssembler {
  protected console = new BrowserConsole().scope('ContexAssembler');

  constructor(private options: ContextAssembler.IOptions) {
    // no-op
  }

  /**
   * Get context from current context menu (or fallback to document context).
   */
  getContext(): ICommandContext | null {
    let context: ICommandContext | null = null;
    try {
      context = this.getContextFromContextMenu();
    } catch (e) {
      this.console.warn(
        'contextMenu is attached, but could not get the context',
        e
      );
      context = null;
    }
    if (context == null) {
      try {
        context = this._contextFromActiveDocument();
      } catch (e) {
        if (
          e instanceof Error &&
          e.message === 'Source line not mapped to virtual position'
        ) {
          this.console.log(
            'Could not get context from active document: it is expected when restoring workspace with open files'
          );
        } else {
          throw e;
        }
      }
    }
    return context;
  }

  isContextMenuOverToken() {
    const context = this.getContextFromContextMenu();
    if (!context) {
      // annoyingly `isEnabled()` gets called again when mouse is over the menu
      // which means we are no longer able to retrieve context; therefore we cache
      // last value and return it if the mouse is over menu.
      return this._wasOverToken;
    }
    const { rootPosition, adapter } = context;
    const editorAccessor = editorAtRootPosition(adapter, rootPosition);
    const editor = editorAccessor.getEditor();
    if (!editor) {
      return;
    }

    const editorPosition = rootPositionToEditorPosition(adapter, rootPosition);

    const offset = editor.getOffsetAt(
      PositionConverter.cm_to_ce(editorPosition)
    );
    const token = editor.getTokenAt(offset);
    const isOverToken = token.value !== '';
    this._wasOverToken = isOverToken;
    return isOverToken;
  }
  private _wasOverToken = false;

  private _contextFromActiveDocument(): ICommandContext | null {
    const adapter = [...this.options.connectionManager.adapters.values()].find(
      adapter => adapter.widget == this.options.app.shell.currentWidget
    );

    if (!adapter) {
      this.console.debug('No adapter');
      return null;
    }

    const editor = adapter.activeEditor!.getEditor();

    if (editor === null) {
      return null;
    }

    let ceCursor = editor.getCursorPosition();
    let cmCursor = PositionConverter.ce_to_cm(ceCursor) as IEditorPosition;

    const virtualDocument = adapter.virtualDocument;
    if (!virtualDocument) {
      console.warn('Could not retrieve current context', virtualDocument);
      return null;
    }
    const rootPosition = virtualDocument.transformFromEditorToRoot(
      adapter.activeEditor!,
      cmCursor
    )!;

    if (rootPosition == null) {
      console.warn('Could not retrieve current context', virtualDocument);
      return null;
    }

    return this._contextFromRoot(adapter, rootPosition);
  }

  private _contextFromRoot(
    adapter: WidgetLSPAdapter<any>,
    rootPosition: IRootPosition
  ): ICommandContext | null {
    const document = documentAtRootPosition(adapter, rootPosition);
    const connection = this.options.connectionManager.connections.get(
      document.uri
    )!;
    const virtualPosition = rootPositionToVirtualPosition(
      adapter,
      rootPosition
    );
    return {
      document: document as any,
      connection,
      virtualPosition,
      rootPosition,
      adapter: adapter
    };
  }

  adapterFromNode(leafNode: HTMLElement): WidgetLSPAdapter<any> | undefined {
    return [...this.options.connectionManager.adapters.values()].find(adapter =>
      adapter.widget.node.contains(leafNode!)
    );
  }

  positionFromCoordinates(
    left: number,
    top: number,
    adapter: WidgetLSPAdapter<any>,
    editorAccessor: Document.IEditor | undefined
  ): IRootPosition | null {
    if (!editorAccessor) {
      return null;
    }

    const editorPosition = this.editorPositionFromCoordinates(
      left,
      top,
      editorAccessor
    );

    if (!editorPosition) {
      return null;
    }

    return editorPositionToRootPosition(
      adapter,
      editorAccessor,
      editorPosition
    );
  }

  editorPositionFromCoordinates(
    left: number,
    top: number,
    editorAccessor: Document.IEditor
  ): IEditorPosition | null {
    const editor = editorAccessor.getEditor();
    if (!editor) {
      return null;
    }
    const position = editor.getPositionForCoordinate({
      left: left,
      right: left,
      bottom: top,
      top: top,
      y: top,
      x: left,
      width: 0,
      height: 0
    } as CodeEditor.ICoordinate);

    if (!position) {
      return null;
    }

    const editorPosition = {
      ch: position.column,
      line: position.line
    } as IEditorPosition;

    return editorPosition;
  }

  /*
   * Attempt to find editor from DOM and then (naively) find `Document.Editor`
   * from `CodeEditor` isntances. The naive approach iterates all the editors
   * (=cells) in the adapter, which is expensive and prone to fail in windowed notebooks.
   *
   * This may not be needed once https://github.com/jupyterlab/jupyterlab/pull/14920
   * is finalised an released.
   */
  editorFromNode(
    adapter: WidgetLSPAdapter<any>,
    node: HTMLElement
  ): Document.IEditor | undefined {
    const cmContent = (node as HTMLElement).closest('.cm-content');
    if (!cmContent) {
      return;
    }
    const cmView = (cmContent as any)?.cmView?.view as EditorView | undefined;

    if (!cmView) {
      return;
    }

    const editorAccessor = adapter.editors
      .map(e => e.ceEditor)
      .find(e => (e.getEditor() as CodeMirrorEditor | null)?.editor === cmView);
    return editorAccessor;
  }

  private getContextFromContextMenu(): ICommandContext | null {
    // Note: could also try using this.app.contextMenu.menu.contentNode position.
    // Note: could add a guard on this.app.contextMenu.menu.isAttached

    // get the first node as it gives the most accurate approximation
    const leafNode = this.options.app.contextMenuHitTest(() => true);

    if (!leafNode) {
      return null;
    }

    let { left, top } = leafNode.getBoundingClientRect();

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    let event = this.options.app._contextMenuEvent;

    // if possible, use more accurate position from the actual event
    // (but this relies on an undocumented and unstable feature)
    if (event !== undefined) {
      left = event.clientX;
      top = event.clientY;
      event.stopPropagation();
    }
    const adapter = this.adapterFromNode(leafNode);

    if (!adapter) {
      return null;
    }

    const accessorFromNode = this.editorFromNode(adapter, leafNode);
    if (!accessorFromNode) {
      // Using `activeEditor` can lead to suprising results in notebook
      // as a cell can be opened over a cell diffferent than the active one.
      this.console.warn(
        'Editor accessor not found from node, falling back to activeEditor'
      );
    }
    const editorAccessor = accessorFromNode
      ? accessorFromNode
      : adapter.activeEditor;
    const rootPosition = this.positionFromCoordinates(
      left,
      top,
      adapter,
      editorAccessor
    );

    if (!rootPosition) {
      return null;
    }

    return this._contextFromRoot(adapter!, rootPosition);
  }
}

export namespace ContextAssembler {
  export interface IOptions {
    app: JupyterFrontEnd;
    connectionManager: ILSPDocumentConnectionManager;
  }
}

export interface ICommandContext {
  document: VirtualDocument;
  connection?: ILSPConnection;
  virtualPosition: IVirtualPosition;
  rootPosition: IRootPosition;
  adapter: WidgetLSPAdapter<IDocumentWidget>;
}
