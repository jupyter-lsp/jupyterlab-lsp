import { JupyterFrontEnd } from '@jupyterlab/application';
import { IDocumentWidget } from '@jupyterlab/docregistry';

import { ILSPConnection, WidgetLSPAdapter, ILSPDocumentConnectionManager, IEditorPosition } from '@jupyterlab/lsp';
import { CodeEditor } from '@jupyterlab/codeeditor';
import { IRootPosition, IVirtualPosition } from '@jupyterlab/lsp';
import { VirtualDocument } from './virtual/document';
import { BrowserConsole } from './virtual/console';
import { PositionConverter, documentAtRootPosition, rootPositionToVirtualPosition } from './converter';


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
        if (e instanceof Error && e.message === 'Source line not mapped to virtual position') {
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
    const offset = editor.getOffsetAt(PositionConverter.cm_to_ce(rootPosition));
    let token = editor.getTokenAt(offset);
    return token.value !== '';
  }

  private _contextFromActiveDocument(): ICommandContext | null {

    const adapter = [...this.options.connectionManager.adapters.values()].find(adapter =>
        adapter.widget == this.options.app.shell.currentWidget
    );

    if (!adapter) {
      this.console.debug('No adapter')
      return null;
    }

    const editor = adapter.activeEditor!.getEditor();

    if (editor === null) {
      return null;
    }

    let ce_cursor = editor.getCursorPosition();
    let cm_cursor = PositionConverter.ce_to_cm(ce_cursor) as IEditorPosition;

    const virtualDocument = adapter.virtualDocument!;
    const rootPosition = virtualDocument.transformFromEditorToRoot(adapter.activeEditor!, cm_cursor)!;

    if (rootPosition == null) {
      console.warn('Could not retrieve current context', virtualDocument);
      return null;
    }

    return this._contextFromRoot(adapter, rootPosition);
  }

  private _contextFromRoot(adapter: WidgetLSPAdapter<any>, rootPosition: IRootPosition): ICommandContext | null {
    // TODO: should probably get the document_at_root_position as before
    const virtualDocument = adapter.virtualDocument!;
    const document = documentAtRootPosition(virtualDocument, rootPosition);
    const connection = this.options.connectionManager.connections.get(document.uri)!;
    const virtualPosition = rootPositionToVirtualPosition(virtualDocument, rootPosition);
    return {
      document: document as any,
      connection,
      virtualPosition,
      rootPosition,
      adapter: adapter
    };
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
    const adapter = [...this.options.connectionManager.adapters.values()].find(adapter =>
        adapter.widget.node.contains(leafNode!)
    );
    const editor = adapter?.activeEditor?.getEditor();
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

    const rootPosition =  {
      ch: position.column,
      line: position.line
    } as IRootPosition;

    return this._contextFromRoot(adapter!, rootPosition);
  }
}

export namespace ContextAssembler {
  export interface IOptions {
    app: JupyterFrontEnd;
    connectionManager: ILSPDocumentConnectionManager
  }
}



export interface ICommandContext {
  document: VirtualDocument;
  connection?: ILSPConnection;
  virtualPosition: IVirtualPosition;
  rootPosition: IRootPosition;
  adapter: WidgetLSPAdapter<IDocumentWidget>;
}
