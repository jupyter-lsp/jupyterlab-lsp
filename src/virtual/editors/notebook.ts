import { Notebook, NotebookPanel } from '@jupyterlab/notebook';
import { Cell } from '@jupyterlab/cells';
import { CodeMirrorEditor } from '@jupyterlab/codemirror';
import { ShowHintOptions } from 'codemirror';
import { IOverridesRegistry } from '../../magics/overrides';
import { IForeignCodeExtractorsRegistry } from '../../extractors/types';
import { VirtualDocument } from '../document';
import { VirtualEditor } from '../editor';
import CodeMirror = require('codemirror');

// @ts-ignore
class DocDispatcher implements CodeMirror.Doc {
  notebook_map: VirtualEditorForNotebook;

  constructor(notebook_map: VirtualEditorForNotebook) {
    // TODO
    this.notebook_map = notebook_map;
  }

  markText(
    from: CodeMirror.Position,
    to: CodeMirror.Position,
    options?: CodeMirror.TextMarkerOptions
  ): CodeMirror.TextMarker {
    // TODO: edgecase: from and to in different cells
    let editor = this.notebook_map.get_editor_at(from);
    return editor
      .getDoc()
      .markText(this.transform(from), this.transform(to), options);
  }

  transform(position: CodeMirror.Position) {
    return this.notebook_map.transform_from_document(position);
  }

  getValue(seperator?: string): string {
    return this.notebook_map.getValue();
  }

  getCursor(start?: string): CodeMirror.Position {
    let cell = this.notebook_map.notebook.activeCell;
    let active_editor = cell.editor as CodeMirrorEditor;
    let cursor = active_editor.editor.getDoc().getCursor(start);
    return this.notebook_map.transform_from_notebook(cell, cursor);
  }
}

// TODO: use proxy, as in https://stackoverflow.com/questions/51865430/typescript-compiler-does-not-know-about-es6-proxy-trap-on-class ?
// TODO: make all un-implemented methods issue a warning to a console for improved diagnostics
//  or just remove them altogether and suppress with ts-ignore so it will be more obvious what is implemented and what is not
//  ideally there would be some kind of a construct which defines a subset of CodeMirror.Editor (Interface?) needed for the adapter
export class VirtualEditorForNotebook extends VirtualEditor {
  notebook: Notebook;
  notebook_panel: NotebookPanel;
  notebook_line_to_virtual_document: Map<number, VirtualDocument>;

  first_line_of_notebook_cell_to_virtual_line: Map<Cell, number>;
  cm_editor_to_cell: Map<CodeMirror.Editor, Cell>;
  language: string;

  constructor(
    notebook_panel: NotebookPanel,
    language: string,
    overrides_registry: IOverridesRegistry,
    foreign_code_extractors: IForeignCodeExtractorsRegistry
  ) {
    super(language, overrides_registry, foreign_code_extractors);
    this.notebook_panel = notebook_panel;
    this.notebook = notebook_panel.content;
    this.first_line_of_notebook_cell_to_virtual_line = new Map();
    this.cm_editor_to_cell = new Map();
    this.overrides_registry = overrides_registry;
    this.code_extractors = foreign_code_extractors;
    this.language = language;
    let handler = {
      get: function(
        target: VirtualEditorForNotebook,
        prop: keyof CodeMirror.Editor,
        receiver: any
      ) {
        if (!(prop in target)) {
          console.warn(
            `Unimplemented method ${prop} for VirtualEditorForNotebook`
          );
          return;
        } else {
          return Reflect.get(target, prop, receiver);
        }
      }
    };
    return new Proxy(this, handler);
  }
  public get transform(): (
    position: CodeMirror.Position
  ) => CodeMirror.Position {
    return position => this.transform_from_document(position);
  }

  public get_editor_index(position: CodeMirror.Position): number {
    let cell = this.get_cell_at(position);
    return this.notebook.widgets.findIndex(other_cell => {
      return cell === other_cell;
    });
  }

  public get get_cell_id(): (position: CodeMirror.Position) => string {
    return position => this.get_cell_at(position).id;
  }

  get_cm_editor(position: CodeMirror.Position) {
    return this.get_editor_at(position);
  }

  showHint: (options: ShowHintOptions) => void;
  state: any;

  addKeyMap(map: string | CodeMirror.KeyMap, bottom?: boolean): void {}

  addLineClass(
    line: any,
    where: string,
    _class_: string
  ): CodeMirror.LineHandle {
    return undefined;
  }

  addLineWidget(
    line: any,
    node: HTMLElement,
    options?: CodeMirror.LineWidgetOptions
  ): CodeMirror.LineWidget {
    return undefined;
  }

  addOverlay(mode: any, options?: any): void {
    for (let cell of this.notebook.widgets) {
      // TODO: use some more intelligent strategy to determine editors to test
      let cm_editor = cell.editor as CodeMirrorEditor;
      cm_editor.editor.addOverlay(mode, options);
    }
  }

  addPanel(
    node: HTMLElement,
    // @ts-ignore
    options?: CodeMirror.ShowPanelOptions
    // @ts-ignore
  ): CodeMirror.Panel {
    return undefined;
  }

  addWidget(
    pos: CodeMirror.Position,
    node: HTMLElement,
    scrollIntoView: boolean
  ): void {}

  blockComment(
    from: Position,
    to: Position,
    // @ts-ignore
    options?: CodeMirror.CommentOptions
  ): void {}

  charCoords(
    pos: CodeMirror.Position,
    mode?: 'window' | 'page' | 'local'
  ): { left: number; right: number; top: number; bottom: number } {
    try {
      let editor = this.get_editor_at(pos);
      return editor.charCoords(pos, mode);
    } catch (e) {
      console.log(e);
      return { bottom: 0, left: 0, right: 0, top: 0 };
    }
  }

  clearGutter(gutterID: string): void {}

  coordsChar(
    object: { left: number; top: number },
    mode?: 'window' | 'page' | 'local'
  ): CodeMirror.Position {
    for (let cell of this.notebook.widgets) {
      // TODO: use some more intelligent strategy to determine editors to test
      let cm_editor = cell.editor as CodeMirrorEditor;
      let pos = cm_editor.editor.coordsChar(object, mode);

      // @ts-ignore
      if (pos.outside === true) {
        continue;
      }

      return this.transform_from_notebook(cell, pos);
    }
  }

  transform_from_notebook(
    cell: Cell,
    position: CodeMirror.Position
  ): CodeMirror.Position {
    // TODO: if cell is not known, refresh
    let shift = this.first_line_of_notebook_cell_to_virtual_line.get(cell);
    if (shift === undefined) {
      throw Error('Cell not found in cell_line_map');
    }
    return {
      ...position,
      line: position.line + shift
    };
  }

  cursorCoords(
    where?: boolean,
    mode?: 'window' | 'page' | 'local'
  ): { left: number; top: number; bottom: number };
  cursorCoords(
    where?: CodeMirror.Position | null,
    mode?: 'window' | 'page' | 'local'
  ): { left: number; top: number; bottom: number };
  cursorCoords(
    where?: boolean | CodeMirror.Position | null,
    mode?: 'window' | 'page' | 'local'
  ): { left: number; top: number; bottom: number } {
    if (typeof where !== 'boolean') {
      let editor = this.get_editor_at(where);
      return editor.cursorCoords(this.transform_from_document(where));
    }
    return { bottom: 0, left: 0, top: 0 };
  }

  get any_editor(): CodeMirror.Editor {
    return (this.notebook.widgets[0].editor as CodeMirrorEditor).editor;
  }

  defaultCharWidth(): number {
    return this.any_editor.defaultCharWidth();
  }

  defaultTextHeight(): number {
    return this.any_editor.defaultTextHeight();
  }

  endOperation(): void {
    for (let cell of this.notebook.widgets) {
      let cm_editor = cell.editor as CodeMirrorEditor;
      cm_editor.editor.endOperation();
    }
  }

  execCommand(name: string): void {
    for (let cell of this.notebook.widgets) {
      let cm_editor = cell.editor as CodeMirrorEditor;
      cm_editor.editor.execCommand(name);
    }
  }

  findPosH(
    start: CodeMirror.Position,
    amount: number,
    unit: string,
    visually: boolean
  ): { line: number; ch: number; hitSide?: boolean } {
    return { ch: 0, line: 0 };
  }

  findPosV(
    start: CodeMirror.Position,
    amount: number,
    unit: string
  ): { line: number; ch: number; hitSide?: boolean } {
    return { ch: 0, line: 0 };
  }

  findWordAt(pos: CodeMirror.Position): CodeMirror.Range {
    return undefined;
  }

  focus(): void {}

  getDoc(): CodeMirror.Doc {
    let dummy_doc = new DocDispatcher(this);
    // @ts-ignore
    return dummy_doc;
  }

  getGutterElement(): HTMLElement {
    return undefined;
  }

  getInputField(): HTMLTextAreaElement {
    return undefined;
  }

  getLineTokens(line: number, precise?: boolean): CodeMirror.Token[] {
    return [];
  }

  getModeAt(pos: CodeMirror.Position): any {
    return this.get_editor_at(pos).getModeAt(this.transform_from_document(pos));
  }

  getOption(option: string): any {
    return this.any_editor.getOption(option);
  }

  getScrollInfo(): CodeMirror.ScrollInfo {
    return undefined;
  }

  getScrollerElement(): HTMLElement {
    return undefined;
  }

  getStateAfter(line?: number): any {}

  getTokenAt(pos: CodeMirror.Position, precise?: boolean): CodeMirror.Token {
    if (pos === undefined) {
      return;
    }
    let editor = this.get_editor_at(pos);
    return editor.getTokenAt(this.transform_from_document(pos));
  }

  getTokenTypeAt(pos: CodeMirror.Position): string {
    let editor = this.get_editor_at(pos);
    return editor.getTokenTypeAt(this.transform_from_document(pos));
  }

  // TODO: make a mapper class, with mapping function only
  get_editor_at(pos: CodeMirror.Position): CodeMirror.Editor {
    return this.virtual_document.virtual_lines.get(pos.line).editor_coordinates
      .editor;
  }

  get_cell_at(pos: CodeMirror.Position): Cell {
    let cm_editor = this.virtual_document.virtual_lines.get(pos.line)
      .editor_coordinates.editor;
    return this.cm_editor_to_cell.get(cm_editor);
  }

  transform_from_document(pos: CodeMirror.Position): CodeMirror.Position {
    // from virtual document space to notebook space
    return {
      ...pos,
      line:
        pos.line -
        this.virtual_document.virtual_lines.get(pos.line).editor_coordinates
          .line_shift
    };
  }

  getValue(seperator?: string): string {
    this.virtual_document.clear();
    this.first_line_of_notebook_cell_to_virtual_line.clear();
    this.cm_editor_to_cell.clear();

    this.notebook.widgets.every(cell => {
      let codemirror_editor = cell.editor as CodeMirrorEditor;
      let cm_editor = codemirror_editor.editor;
      this.cm_editor_to_cell.set(cm_editor, cell);

      if (cell.model.type === 'code') {
        let cell_code = cm_editor.getValue(seperator);
        // every code cell is placed into the cell-map
        this.first_line_of_notebook_cell_to_virtual_line.set(
          cell,
          this.virtual_document.last_line
        );

        this.virtual_document.append_code_block(cell_code, cm_editor);
      }
      return true;
    });

    return this.virtual_document.value;
  }

  getViewport(): { from: number; to: number } {
    return { from: 0, to: 0 };
  }

  getWrapperElement(): HTMLElement {
    return this.notebook_panel.node;
  }

  hasFocus(): boolean {
    return false;
  }

  heightAtLine(
    line: any,
    mode?: 'window' | 'page' | 'local',
    includeWidgets?: boolean
  ): number {
    return 0;
  }

  indentLine(line: number, dir?: string): void {}

  isReadOnly(): boolean {
    return false;
  }

  lineAtHeight(height: number, mode?: 'window' | 'page' | 'local'): number {
    return 0;
  }

  lineComment(
    from: Position,
    to: Position,
    // @ts-ignore
    options?: CodeMirror.CommentOptions
  ): void {}

  lineInfo(
    line: any
  ): {
    line: any;
    handle: any;
    text: string;
    gutterMarkers: any;
    textClass: string;
    bgClass: string;
    wrapClass: string;
    widgets: any;
  } {
    return {
      bgClass: '',
      gutterMarkers: undefined,
      handle: undefined,
      line: undefined,
      text: '',
      textClass: '',
      widgets: undefined,
      wrapClass: ''
    };
  }

  off(eventName: string, handler: (instance: CodeMirror.Editor) => void): void;
  off(
    eventName: 'change',
    handler: (
      instance: CodeMirror.Editor,
      change: CodeMirror.EditorChangeLinkedList
    ) => void
  ): void;
  off(
    eventName: 'changes',
    handler: (
      instance: CodeMirror.Editor,
      change: CodeMirror.EditorChangeLinkedList[]
    ) => void
  ): void;
  off(
    eventName: 'beforeChange',
    handler: (
      instance: CodeMirror.Editor,
      change: CodeMirror.EditorChangeCancellable
    ) => void
  ): void;
  off(
    eventName: 'cursorActivity',
    handler: (instance: CodeMirror.Editor) => void
  ): void;
  off(
    eventName: 'beforeSelectionChange',
    handler: (
      instance: CodeMirror.Editor,
      selection: { head: CodeMirror.Position; anchor: CodeMirror.Position }
    ) => void
  ): void;
  off(
    eventName: 'viewportChange',
    handler: (instance: CodeMirror.Editor, from: number, to: number) => void
  ): void;
  off(
    eventName: 'gutterClick',
    handler: (
      instance: CodeMirror.Editor,
      line: number,
      gutter: string,
      clickEvent: Event
    ) => void
  ): void;
  off(eventName: 'focus', handler: (instance: CodeMirror.Editor) => void): void;
  off(eventName: 'blur', handler: (instance: CodeMirror.Editor) => void): void;
  off(
    eventName: 'scroll',
    handler: (instance: CodeMirror.Editor) => void
  ): void;
  off(
    eventName: 'update',
    handler: (instance: CodeMirror.Editor) => void
  ): void;
  off(
    eventName: 'renderLine',
    handler: (
      instance: CodeMirror.Editor,
      line: CodeMirror.LineHandle,
      element: HTMLElement
    ) => void
  ): void;
  off(
    eventName:
      | 'mousedown'
      | 'dblclick'
      | 'touchstart'
      | 'contextmenu'
      | 'keydown'
      | 'keypress'
      | 'keyup'
      | 'cut'
      | 'copy'
      | 'paste'
      | 'dragstart'
      | 'dragenter'
      | 'dragover'
      | 'dragleave'
      | 'drop',
    handler: (instance: CodeMirror.Editor, event: Event) => void
  ): void;
  off(
    eventName: string,
    handler: (doc: CodeMirror.Doc, event: any) => void
  ): void;
  off(
    eventName:
      | string
      | 'change'
      | 'changes'
      | 'beforeChange'
      | 'cursorActivity'
      | 'beforeSelectionChange'
      | 'viewportChange'
      | 'gutterClick'
      | 'focus'
      | 'blur'
      | 'scroll'
      | 'update'
      | 'renderLine'
      | CodeMirror.DOMEvent,
    handler:
      | ((instance: CodeMirror.Editor) => void)
      | ((
          instance: CodeMirror.Editor,
          change: CodeMirror.EditorChangeLinkedList
        ) => void)
      | ((
          instance: CodeMirror.Editor,
          change: CodeMirror.EditorChangeLinkedList[]
        ) => void)
      | ((
          instance: CodeMirror.Editor,
          change: CodeMirror.EditorChangeCancellable
        ) => void)
      | ((
          instance: CodeMirror.Editor,
          selection: { head: CodeMirror.Position; anchor: CodeMirror.Position }
        ) => void)
      | ((instance: CodeMirror.Editor, from: number, to: number) => void)
      | ((
          instance: CodeMirror.Editor,
          line: number,
          gutter: string,
          clickEvent: Event
        ) => void)
      | ((
          instance: CodeMirror.Editor,
          line: CodeMirror.LineHandle,
          element: HTMLElement
        ) => void)
      | ((instance: CodeMirror.Editor, event: Event) => void)
      | ((doc: CodeMirror.Doc, event: any) => void)
  ): void {}

  on(eventName: string, handler: (instance: CodeMirror.Editor) => void): void;
  on(
    eventName: 'change',
    handler: (
      instance: CodeMirror.Editor,
      change: CodeMirror.EditorChangeLinkedList
    ) => void
  ): void;
  on(
    eventName: 'changes',
    handler: (
      instance: CodeMirror.Editor,
      change: CodeMirror.EditorChangeLinkedList[]
    ) => void
  ): void;
  on(
    eventName: 'beforeChange',
    handler: (
      instance: CodeMirror.Editor,
      change: CodeMirror.EditorChangeCancellable
    ) => void
  ): void;
  on(
    eventName: 'cursorActivity',
    handler: (instance: CodeMirror.Editor) => void
  ): void;
  on(
    eventName: 'beforeSelectionChange',
    handler: (
      instance: CodeMirror.Editor,
      selection: { head: CodeMirror.Position; anchor: CodeMirror.Position }
    ) => void
  ): void;
  on(
    eventName: 'viewportChange',
    handler: (instance: CodeMirror.Editor, from: number, to: number) => void
  ): void;
  on(
    eventName: 'gutterClick',
    handler: (
      instance: CodeMirror.Editor,
      line: number,
      gutter: string,
      clickEvent: Event
    ) => void
  ): void;
  on(eventName: 'focus', handler: (instance: CodeMirror.Editor) => void): void;
  on(eventName: 'blur', handler: (instance: CodeMirror.Editor) => void): void;
  on(eventName: 'scroll', handler: (instance: CodeMirror.Editor) => void): void;
  on(eventName: 'update', handler: (instance: CodeMirror.Editor) => void): void;
  on(
    eventName: 'renderLine',
    handler: (
      instance: CodeMirror.Editor,
      line: CodeMirror.LineHandle,
      element: HTMLElement
    ) => void
  ): void;
  on(
    eventName:
      | 'mousedown'
      | 'dblclick'
      | 'touchstart'
      | 'contextmenu'
      | 'keydown'
      | 'keypress'
      | 'keyup'
      | 'cut'
      | 'copy'
      | 'paste'
      | 'dragstart'
      | 'dragenter'
      | 'dragover'
      | 'dragleave'
      | 'drop',
    handler: (instance: CodeMirror.Editor, event: Event) => void
  ): void;
  on(
    eventName: 'overwriteToggle',
    handler: (instance: CodeMirror.Editor, overwrite: boolean) => void
  ): void;
  on(
    eventName: string,
    handler: (doc: CodeMirror.Doc, event: any) => void
  ): void;
  on(
    eventName:
      | string
      | 'change'
      | 'changes'
      | 'beforeChange'
      | 'cursorActivity'
      | 'beforeSelectionChange'
      | 'viewportChange'
      | 'gutterClick'
      | 'focus'
      | 'blur'
      | 'scroll'
      | 'update'
      | 'renderLine'
      | CodeMirror.DOMEvent
      | 'overwriteToggle',
    handler:
      | ((instance: CodeMirror.Editor) => void)
      | ((
          instance: CodeMirror.Editor,
          change: CodeMirror.EditorChangeLinkedList
        ) => void)
      | ((
          instance: CodeMirror.Editor,
          change: CodeMirror.EditorChangeLinkedList[]
        ) => void)
      | ((
          instance: CodeMirror.Editor,
          change: CodeMirror.EditorChangeCancellable
        ) => void)
      | ((
          instance: CodeMirror.Editor,
          selection: { head: CodeMirror.Position; anchor: CodeMirror.Position }
        ) => void)
      | ((instance: CodeMirror.Editor, from: number, to: number) => void)
      | ((
          instance: CodeMirror.Editor,
          line: number,
          gutter: string,
          clickEvent: Event
        ) => void)
      | ((
          instance: CodeMirror.Editor,
          line: CodeMirror.LineHandle,
          element: HTMLElement
        ) => void)
      | ((instance: CodeMirror.Editor, event: Event) => void)
      | ((instance: CodeMirror.Editor, overwrite: boolean) => void)
      | ((doc: CodeMirror.Doc, event: any) => void)
  ): void {
    let wrapped_handler = (instance_or_doc: any, a: any, b: any, c: any) => {
      let editor = instance_or_doc as CodeMirror.Editor;
      try {
        editor.getDoc();
        // @ts-ignore
        return handler(this, a, b, c);
      } catch (e) {
        // TODO verify that the error was due to getDoc not existing on editor
        console.log(e);
        // also this is not currently in use
        console.log('Dispatching wrapped doc handler with', this);
        // @ts-ignore
        return handler(this.getDoc(), a, b, c);
      }
    };

    const cells_with_handlers = new Set<Cell>();

    for (let cell of this.notebook.widgets) {
      // TODO: use some more intelligent strategy to determine editors to test
      let cm_editor = (cell.editor as CodeMirrorEditor).editor;
      if (cell.model.type === 'code') {
        cells_with_handlers.add(cell);
        // @ts-ignore
        cm_editor.on(eventName, wrapped_handler);
      }
    }
    this.notebook.activeCellChanged.connect((notebook, cell) => {
      let cm_editor = (cell.editor as CodeMirrorEditor).editor;
      if (!cells_with_handlers.has(cell) && cell.model.type === 'code') {
        // @ts-ignore
        cm_editor.on(eventName, wrapped_handler);
      }
    });
  }

  operation<T>(fn: () => T): T {
    return undefined;
  }

  refresh(): void {}

  removeKeyMap(map: string | CodeMirror.KeyMap): void {}

  removeLineClass(
    line: any,
    where: string,
    class_?: string
  ): CodeMirror.LineHandle {
    return undefined;
  }

  removeOverlay(mode: any): void {}

  scrollIntoView(pos: CodeMirror.Position | null, margin?: number): void;
  scrollIntoView(
    pos: { left: number; top: number; right: number; bottom: number },
    margin?: number
  ): void;
  scrollIntoView(pos: { line: number; ch: number }, margin?: number): void;
  scrollIntoView(
    pos: { from: CodeMirror.Position; to: CodeMirror.Position },
    margin?: number
  ): void;
  scrollIntoView(
    pos:
      | CodeMirror.Position
      | null
      | { left: number; top: number; right: number; bottom: number }
      | { line: number; ch: number }
      | { from: CodeMirror.Position; to: CodeMirror.Position },
    margin?: number
  ): void {}

  scrollTo(x?: number | null, y?: number | null): void {}

  setGutterMarker(
    line: any,
    gutterID: string,
    value: HTMLElement | null
  ): CodeMirror.LineHandle {
    return undefined;
  }

  setOption(option: string, value: any): void {}

  setSize(width: any, height: any): void {}

  setValue(content: string): void {}

  startOperation(): void {}

  swapDoc(doc: CodeMirror.Doc): CodeMirror.Doc {
    return undefined;
  }

  // @ts-ignore
  toggleComment(options?: CodeMirror.CommentOptions): void {}

  toggleOverwrite(value?: boolean): void {}

  triggerOnKeyDown(event: Event): void {}

  uncomment(
    from: Position,
    to: Position,
    // @ts-ignore
    options?: CodeMirror.CommentOptions
  ): boolean {
    return false;
  }
}
