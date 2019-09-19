import { ContextMenu } from '@phosphor/widgets';
import { CommandRegistry } from '@phosphor/commands';
import { VirtualDocument } from '../../virtual/document';
import { CodeMirrorHandler, VirtualEditor } from '../../virtual/editor';
import { LSPConnection } from '../../connection';
import {
  IEditorPosition,
  IRootPosition,
  IVirtualPosition
} from '../../positioning';
import { IJupyterLabComponentsManager } from '../jupyterlab/jl_adapter';
import { Listener } from 'events';
import * as lsProtocol from 'vscode-languageserver-protocol';
import { PositionConverter } from '../../converter';
import { CodeMirror } from './cm_adapter';

export interface ILSPFeature {
  is_registered: boolean;

  virtual_editor: VirtualEditor;
  virtual_document: VirtualDocument;
  connection: LSPConnection;
  jupyterlab_components: IJupyterLabComponentsManager;
  /**
   * Connect event handlers to the editor, virtual document and connection(s)
   */
  register(): void;
  /**
   * Will allow the user to disable specific functions
   */
  isEnabled(): boolean;

  /** Return JupyterLab commands to be registered;
   * intended for single-use in index.ts (during extension registration)
   */
  commands: Map<string, CommandRegistry.ICommandOptions>;
  /** Return the context menu commands to be added during extension registration.
   * The commands would be grouped by target context menu (like Cell or FileEditor).
   */
  contextMenuCommands: Map<string, ContextMenu.IItemOptions>;
  /**
   * Remove event handlers on destruction
   */
  remove(): void;
  afterChange(
    change: CodeMirror.EditorChange, // TODO: provide an editor-diagnostic abstraction layer for EditorChange
    root_position: IRootPosition
  ): void;
}

export interface IEditorRange {
  start: IEditorPosition;
  end: IEditorPosition;
  editor: CodeMirror.Editor;
}

export class CodeMirrorLSPFeature implements ILSPFeature {
  protected readonly editor_handlers: Map<string, CodeMirrorHandler>;
  protected readonly connection_handlers: Map<string, Listener>;
  public is_registered: boolean;

  constructor(
    public virtual_editor: VirtualEditor,
    public virtual_document: VirtualDocument,
    public connection: LSPConnection,
    public jupyterlab_components: IJupyterLabComponentsManager
  ) {
    this.editor_handlers = new Map();
    this.connection_handlers = new Map();
    this.is_registered = false;
  }

  register(): void {
    // register editor handlers
    for (let [event_name, handler] of this.editor_handlers) {
      this.virtual_editor.on(event_name, handler);
    }
    // register connection handlers
    for (let [event_name, handler] of this.connection_handlers) {
      this.connection.on(event_name, handler);
    }
    this.is_registered = true;
  }

  isEnabled() {
    // TODO
    return true;
  }

  // TODO: implement in sub-classes (move out of index.ts)
  readonly commands = new Map<string, CommandRegistry.ICommandOptions>();
  readonly contextMenuCommands = new Map<string, ContextMenu.IItemOptions>();

  remove(): void {
    // unregister editor handlers
    for (let [event_name, handler] of this.editor_handlers) {
      this.virtual_editor.off(event_name, handler);
    }
    // unregister connection handlers
    for (let [event_name, handler] of this.connection_handlers) {
      this.connection.off(event_name, handler);
    }
  }

  afterChange(
    change: CodeMirror.EditorChange,
    root_position: IRootPosition
  ): void {}

  protected range_to_editor_range(
    range: lsProtocol.Range,
    cm_editor?: CodeMirror.Editor
  ): IEditorRange {
    let start = PositionConverter.lsp_to_cm(range.start) as IVirtualPosition;
    let end = PositionConverter.lsp_to_cm(range.end) as IVirtualPosition;

    if (typeof cm_editor === 'undefined') {
      let start_in_root = this.transform_virtual_position_to_root_position(
        start
      );
      cm_editor = this.virtual_editor.get_editor_at_root_position(
        start_in_root
      );
    }

    return {
      start: this.virtual_document.transform_virtual_to_editor(start),
      end: this.virtual_document.transform_virtual_to_editor(end),
      editor: cm_editor
    };
  }

  protected position_from_mouse(event: MouseEvent): IRootPosition {
    return this.virtual_editor.coordsChar(
      {
        left: event.clientX,
        top: event.clientY
      },
      'window'
    ) as IRootPosition;
  }

  protected transform_virtual_position_to_root_position(
    start: IVirtualPosition
  ): IRootPosition {
    let cm_editor = this.virtual_document.virtual_lines.get(start.line).editor;
    let editor_position = this.virtual_document.transform_virtual_to_editor(
      start
    );
    return this.virtual_editor.transform_editor_to_root(
      cm_editor,
      editor_position
    );
  }

  protected get_cm_editor(position: IRootPosition) {
    return this.virtual_editor.get_cm_editor(position);
  }

  protected get_language_at(
    position: IEditorPosition,
    editor: CodeMirror.Editor
  ) {
    return editor.getModeAt(position).name;
  }

  protected extract_last_character(change: CodeMirror.EditorChange): string {
    if (change.origin === 'paste') {
      return change.text[0][change.text.length - 1];
    } else {
      return change.text[0][0];
    }
  }

  protected highlight_range(
    range: IEditorRange,
    class_name: string
  ): CodeMirror.TextMarker {
    return range.editor
      .getDoc()
      .markText(range.start, range.end, { className: class_name });
  }
}
