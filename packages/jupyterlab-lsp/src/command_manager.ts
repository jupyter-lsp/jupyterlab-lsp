import { JupyterFrontEnd } from '@jupyterlab/application';
import { CodeEditor } from '@jupyterlab/codeeditor';
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
  editorPositionToRootPosition
} from './converter';
import { BrowserConsole } from './virtual/console';
import { VirtualDocument } from './virtual/document';

// TODO: reconsider naming
export class ContextAssembler {
  protected console = new BrowserConsole().scope('ContexAssembler');

  constructor(private options: ContextAssembler.IOptions) {
    // no-op
  }

  get isContextMenuOpen(): boolean {
    return this.options.app.contextMenu.menu.isAttached;
  }

  getContext(): ICommandContext | null {
    let context: ICommandContext | null = null;
    if (this.isContextMenuOpen) {
      try {
        context = this.getContextFromContextMenu();
      } catch (e) {
        this.console.warn(
          'contextMenu is attached, but could not get the context',
          e
        );
        context = null;
      }
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
      return false;
    }
    const { rootPosition, adapter } = context;
    const editor = adapter.activeEditor?.getEditor();
    if (!editor) {
      return;
    }
    // TODO are these offsets right?
    const offset = editor.getOffsetAt(PositionConverter.cm_to_ce(rootPosition));
    const token = editor.getTokenAt(offset);
    return token.value !== '';
  }

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

    let ce_cursor = editor.getCursorPosition();
    let cm_cursor = PositionConverter.ce_to_cm(ce_cursor) as IEditorPosition;

    const virtualDocument = adapter.virtualDocument;
    if (!virtualDocument) {
      console.warn('Could not retrieve current context', virtualDocument);
      return null;
    }
    const rootPosition = virtualDocument.transformFromEditorToRoot(
      adapter.activeEditor!,
      cm_cursor
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
    adapter: WidgetLSPAdapter<any>
  ): IRootPosition | null {
    const editorAccessor = adapter.activeEditor;

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

  private getContextFromContextMenu(): ICommandContext | null {
    // Note: could also try using this.app.contextMenu.menu.contentNode position.
    // Note: could add a guard on this.app.contextMenu.menu.isAttached

    // get the first node as it gives the most accurate approximation
    let leafNode = this.options.app.contextMenuHitTest(() => true);

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

    const rootPosition = this.positionFromCoordinates(left, top, adapter);

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
