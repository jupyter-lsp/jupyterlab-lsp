import {JupyterFrontEnd, JupyterFrontEndPlugin} from '@jupyterlab/application';
import {ICommandPalette} from "@jupyterlab/apputils";
import {INotebookTracker, Notebook, NotebookPanel} from "@jupyterlab/notebook";
import {CodeMirrorEditor} from '@jupyterlab/codemirror';
import {FileEditor, IEditorTracker} from '@jupyterlab/fileeditor';
import {ISettingRegistry, PathExt} from '@jupyterlab/coreutils';
import {IDocumentManager} from '@jupyterlab/docmanager';
import { Cell } from '@jupyterlab/cells';

import {FileEditorJumper} from "@krassowski/jupyterlab_go_to_definition/lib/jumpers/fileeditor";
import {NotebookJumper} from "@krassowski/jupyterlab_go_to_definition/lib/jumpers/notebook";

import 'codemirror/addon/hint/show-hint.css';
import 'codemirror/addon/hint/show-hint';

import 'lsp-editor-adapter/lib/codemirror-lsp.css';
import {CodeMirrorAdapter, IPosition, LspWsConnection} from 'lsp-editor-adapter';
import {IDocumentWidget} from "@jupyterlab/docregistry";
import {CodeEditor} from "@jupyterlab/codeeditor";
import {ICompletionManager} from '@jupyterlab/completer';
import * as lsProtocol from "vscode-languageserver-protocol";
import {LSPConnector} from "./completion";
import CodeMirror = require("codemirror");
import { ShowHintOptions } from 'codemirror';



class CodeMirrorAdapterExtension extends CodeMirrorAdapter {

  public handleGoTo(locations: any) {
    // @ts-ignore
    this._removeTooltip();

    // do NOT handle GoTo actions here
  }

  public handleCompletion(completions: lsProtocol.CompletionItem[]) {
    // do NOT handle completion here
  };

}

interface ICellTransform {
  editor: CodeMirror.Editor,
  line_shift: number;
}

// TODO: use proxy, as in https://stackoverflow.com/questions/51865430/typescript-compiler-does-not-know-about-es6-proxy-trap-on-class
// @ts-ignore
class DocDispatcher implements CodeMirror.Doc {

  notebook_map: NotebookAsSingleEditor;

  constructor(notebook_map: NotebookAsSingleEditor) {
    // TODO
    this.notebook_map = notebook_map
  }

  markText(from: CodeMirror.Position, to: CodeMirror.Position, options?: CodeMirror.TextMarkerOptions): CodeMirror.TextMarker {
    // TODO: edgecase: from and to in different cells
    let editor = this.notebook_map.get_editor_at(from);
    return editor.getDoc().markText(this.notebook_map.transform(from), this.notebook_map.transform(to), options);
  }

  getValue(seperator?: string): string {
    return this.notebook_map.getValue();
  }

  getCursor(start?: string): CodeMirror.Position {
    let active_editor = this.notebook_map.notebook.activeCell.editor as CodeMirrorEditor;
    return active_editor.editor.getDoc().getCursor(start);
  }
  

}

class NotebookAsSingleEditor implements CodeMirror.Editor {
  notebook: Notebook;
  notebook_panel: NotebookPanel;
  line_cell_map: Map<number, ICellTransform>;
  cell_line_map: Map<Cell, number>;

  constructor(notebook_panel: NotebookPanel) {
    this.notebook_panel = notebook_panel;
    this.notebook = notebook_panel.content;
    this.line_cell_map = new Map();
    this.cell_line_map = new Map()
  }

  showHint: (options: ShowHintOptions) => void;
  state: any;

  addKeyMap(map: string | CodeMirror.KeyMap, bottom?: boolean): void {
  }

  addLineClass(line: any, where: string, _class_: string): CodeMirror.LineHandle {
    return undefined;
  }

  addLineWidget(line: any, node: HTMLElement, options?: CodeMirror.LineWidgetOptions): CodeMirror.LineWidget {
    return undefined;
  }

  addOverlay(mode: any, options?: any): void {
    for (let cell of this.notebook.widgets) {
      // TODO: use some more intelligent strategy to determine editors to test
      let cm_editor = cell.editor as CodeMirrorEditor;
      cm_editor.editor.addOverlay(mode, options);
    }
  }

  // @ts-ignore
  addPanel(node: HTMLElement, options?: ShowPanelOptions): Panel {
    return undefined;
  }

  addWidget(pos: CodeMirror.Position, node: HTMLElement, scrollIntoView: boolean): void {
  }

  // @ts-ignore
  blockComment(from: Position, to: Position, options?: CommentOptions): void {
  }

  charCoords(pos: CodeMirror.Position, mode?: "window" | "page" | "local"): { left: number; right: number; top: number; bottom: number } {
    return {bottom: 0,left: 0, right: 0, top: 0};
  }

  clearGutter(gutterID: string): void {
  }

  coordsChar(object: { left: number; top: number }, mode?: "window" | "page" | "local"): CodeMirror.Position {
    for (let cell of this.notebook.widgets) {
      // TODO: use some more intelligent strategy to determine editors to test
      let cm_editor = cell.editor as CodeMirrorEditor;
      let pos = cm_editor.editor.coordsChar(object, mode);

      // @ts-ignore
      if(pos.outside === true) {
        continue
      }
      return {
        ...pos,
        line: pos.line + this.cell_line_map.get(cell)
      };
    }
  }

  cursorCoords(where?: boolean, mode?: "window" | "page" | "local"): { left: number; top: number; bottom: number };
  cursorCoords(where?: CodeMirror.Position | null, mode?: "window" | "page" | "local"): { left: number; top: number; bottom: number };
  cursorCoords(where?: boolean | CodeMirror.Position | null, mode?: "window" | "page" | "local"): { left: number; top: number; bottom: number } {

    if (typeof where !== "boolean") {
      let editor = this.get_editor_at(where);
      return editor.cursorCoords(this.transform(where));
    }
    return {bottom: 0, left: 0, top: 0};
  }

  defaultCharWidth(): number {
    return (this.notebook.widgets[0].editor as CodeMirrorEditor).editor.defaultCharWidth();
  }

  defaultTextHeight(): number {
    return (this.notebook.widgets[0].editor as CodeMirrorEditor).editor.defaultTextHeight();
  }

  endOperation(): void {
    for (let cell of this.notebook.widgets) {
      let cm_editor = cell.editor as CodeMirrorEditor;
      cm_editor.editor.endOperation()
    }
  }

  execCommand(name: string): void {
    for (let cell of this.notebook.widgets) {
      let cm_editor = cell.editor as CodeMirrorEditor;
      cm_editor.editor.execCommand(name)
    }

  }

  findPosH(start: CodeMirror.Position, amount: number, unit: string, visually: boolean): { line: number; ch: number; hitSide?: boolean } {
    return {ch: 0, line: 0};
  }

  findPosV(start: CodeMirror.Position, amount: number, unit: string): { line: number; ch: number; hitSide?: boolean } {
    return {ch: 0, line: 0};
  }

  findWordAt(pos: CodeMirror.Position): CodeMirror.Range {
    return undefined;
  }

  focus(): void {
  }

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
  }

  getOption(option: string): any {
  }

  getScrollInfo(): CodeMirror.ScrollInfo {
    return undefined;
  }

  getScrollerElement(): HTMLElement {
    return undefined;
  }

  getStateAfter(line?: number): any {
  }

  getTokenAt(pos: CodeMirror.Position, precise?: boolean): CodeMirror.Token {
    let editor = this.get_editor_at(pos);
    return editor.getTokenAt(this.transform(pos));
  }

  getTokenTypeAt(pos: CodeMirror.Position): string {
    let editor = this.get_editor_at(pos);
    return editor.getTokenTypeAt(this.transform(pos));
  }

  // TODO: make a mapper class, with mapping function only
  get_editor_at(pos: CodeMirror.Position) {
    return this.line_cell_map.get(pos.line).editor
  }

  transform(pos: CodeMirror.Position): CodeMirror.Position {
    return {
      ...pos,
      // DOES it work like that? TODO
      line: pos.line - this.line_cell_map.get(pos.line).line_shift,
    }
  }

  getValue(seperator?: string): string {
    let value = '';
    this.line_cell_map.clear();
    let last_line = 0;
    this.notebook.widgets.every((cell) => {
      let codemirror_editor = cell.editor as CodeMirrorEditor;
      if(cell.model.type == 'code') {
        let lines = codemirror_editor.editor.getValue(seperator);
        // TODO: use blacklist for cells with foreign language code
        //  TODO: have a second LSP for foreign language!
        if (lines.startsWith('%%'))
          return true;
        // TODO one line is necessary, next two lines are to silence linters - ideally this would be configurable
        value += lines + '\n';// + '\n\n';
        let cell_lines = lines.split('\n').length;
        this.cell_line_map.set(cell, last_line);
        for(let i = 0; i < cell_lines; i++) {
          // TODO: use better structure (tree with ranges?)
          this.line_cell_map.set(
            last_line + i, {editor: codemirror_editor.editor, line_shift: last_line}
          )
        }
        // definitely works without it
        last_line += cell_lines// + 2
      }
      return true;
    });

    return value;
  }

  getViewport(): { from: number; to: number } {
    return {from: 0, to: 0};
  }

  getWrapperElement(): HTMLElement {
    return this.notebook_panel.node;
  }

  hasFocus(): boolean {
    return false;
  }

  heightAtLine(line: any, mode?: "window" | "page" | "local", includeWidgets?: boolean): number {
    return 0;
  }

  indentLine(line: number, dir?: string): void {
  }

  isReadOnly(): boolean {
    return false;
  }

  lineAtHeight(height: number, mode?: "window" | "page" | "local"): number {
    return 0;
  }

  // @ts-ignore
  lineComment(from: Position, to: Position, options?: CommentOptions): void {
  }

  lineInfo(line: any): { line: any; handle: any; text: string; gutterMarkers: any; textClass: string; bgClass: string; wrapClass: string; widgets: any } {
    return {
      bgClass: "", gutterMarkers: undefined, handle: undefined,
      line: undefined, text: "", textClass: "", widgets: undefined,
      wrapClass: "" };
  }

  off(eventName: string, handler: (instance: CodeMirror.Editor) => void): void;
  off(eventName: "change", handler: (instance: CodeMirror.Editor, change: CodeMirror.EditorChangeLinkedList) => void): void;
  off(eventName: "changes", handler: (instance: CodeMirror.Editor, change: CodeMirror.EditorChangeLinkedList[]) => void): void;
  off(eventName: "beforeChange", handler: (instance: CodeMirror.Editor, change: CodeMirror.EditorChangeCancellable) => void): void;
  off(eventName: "cursorActivity", handler: (instance: CodeMirror.Editor) => void): void;
  off(eventName: "beforeSelectionChange", handler: (instance: CodeMirror.Editor, selection: { head: CodeMirror.Position; anchor: CodeMirror.Position }) => void): void;
  off(eventName: "viewportChange", handler: (instance: CodeMirror.Editor, from: number, to: number) => void): void;
  off(eventName: "gutterClick", handler: (instance: CodeMirror.Editor, line: number, gutter: string, clickEvent: Event) => void): void;
  off(eventName: "focus", handler: (instance: CodeMirror.Editor) => void): void;
  off(eventName: "blur", handler: (instance: CodeMirror.Editor) => void): void;
  off(eventName: "scroll", handler: (instance: CodeMirror.Editor) => void): void;
  off(eventName: "update", handler: (instance: CodeMirror.Editor) => void): void;
  off(eventName: "renderLine", handler: (instance: CodeMirror.Editor, line: CodeMirror.LineHandle, element: HTMLElement) => void): void;
  off(eventName: "mousedown" | "dblclick" | "touchstart" | "contextmenu" | "keydown" | "keypress" | "keyup" | "cut" | "copy" | "paste" | "dragstart" | "dragenter" | "dragover" | "dragleave" | "drop", handler: (instance: CodeMirror.Editor, event: Event) => void): void;
  off(eventName: string, handler: (doc: CodeMirror.Doc, event: any) => void): void;
  off(eventName: string | "change" | "changes" | "beforeChange" | "cursorActivity" | "beforeSelectionChange" | "viewportChange" | "gutterClick" | "focus" | "blur" | "scroll" | "update" | "renderLine" | CodeMirror.DOMEvent, handler: ((instance: CodeMirror.Editor) => void) | ((instance: CodeMirror.Editor, change: CodeMirror.EditorChangeLinkedList) => void) | ((instance: CodeMirror.Editor, change: CodeMirror.EditorChangeLinkedList[]) => void) | ((instance: CodeMirror.Editor, change: CodeMirror.EditorChangeCancellable) => void) | ((instance: CodeMirror.Editor, selection: { head: CodeMirror.Position; anchor: CodeMirror.Position }) => void) | ((instance: CodeMirror.Editor, from: number, to: number) => void) | ((instance: CodeMirror.Editor, line: number, gutter: string, clickEvent: Event) => void) | ((instance: CodeMirror.Editor, line: CodeMirror.LineHandle, element: HTMLElement) => void) | ((instance: CodeMirror.Editor, event: Event) => void) | ((doc: CodeMirror.Doc, event: any) => void)): void {
  }

  on(eventName: string, handler: (instance: CodeMirror.Editor) => void): void;
  on(eventName: "change", handler: (instance: CodeMirror.Editor, change: CodeMirror.EditorChangeLinkedList) => void): void;
  on(eventName: "changes", handler: (instance: CodeMirror.Editor, change: CodeMirror.EditorChangeLinkedList[]) => void): void;
  on(eventName: "beforeChange", handler: (instance: CodeMirror.Editor, change: CodeMirror.EditorChangeCancellable) => void): void;
  on(eventName: "cursorActivity", handler: (instance: CodeMirror.Editor) => void): void;
  on(eventName: "beforeSelectionChange", handler: (instance: CodeMirror.Editor, selection: { head: CodeMirror.Position; anchor: CodeMirror.Position }) => void): void;
  on(eventName: "viewportChange", handler: (instance: CodeMirror.Editor, from: number, to: number) => void): void;
  on(eventName: "gutterClick", handler: (instance: CodeMirror.Editor, line: number, gutter: string, clickEvent: Event) => void): void;
  on(eventName: "focus", handler: (instance: CodeMirror.Editor) => void): void;
  on(eventName: "blur", handler: (instance: CodeMirror.Editor) => void): void;
  on(eventName: "scroll", handler: (instance: CodeMirror.Editor) => void): void;
  on(eventName: "update", handler: (instance: CodeMirror.Editor) => void): void;
  on(eventName: "renderLine", handler: (instance: CodeMirror.Editor, line: CodeMirror.LineHandle, element: HTMLElement) => void): void;
  on(eventName: "mousedown" | "dblclick" | "touchstart" | "contextmenu" | "keydown" | "keypress" | "keyup" | "cut" | "copy" | "paste" | "dragstart" | "dragenter" | "dragover" | "dragleave" | "drop", handler: (instance: CodeMirror.Editor, event: Event) => void): void;
  on(eventName: "overwriteToggle", handler: (instance: CodeMirror.Editor, overwrite: boolean) => void): void;
  on(eventName: string, handler: (doc: CodeMirror.Doc, event: any) => void): void;
  on(eventName: string | "change" | "changes" | "beforeChange" | "cursorActivity" | "beforeSelectionChange" | "viewportChange" | "gutterClick" | "focus" | "blur" | "scroll" | "update" | "renderLine" | CodeMirror.DOMEvent | "overwriteToggle", handler: ((instance: CodeMirror.Editor) => void) | ((instance: CodeMirror.Editor, change: CodeMirror.EditorChangeLinkedList) => void) | ((instance: CodeMirror.Editor, change: CodeMirror.EditorChangeLinkedList[]) => void) | ((instance: CodeMirror.Editor, change: CodeMirror.EditorChangeCancellable) => void) | ((instance: CodeMirror.Editor, selection: { head: CodeMirror.Position; anchor: CodeMirror.Position }) => void) | ((instance: CodeMirror.Editor, from: number, to: number) => void) | ((instance: CodeMirror.Editor, line: number, gutter: string, clickEvent: Event) => void) | ((instance: CodeMirror.Editor, line: CodeMirror.LineHandle, element: HTMLElement) => void) | ((instance: CodeMirror.Editor, event: Event) => void) | ((instance: CodeMirror.Editor, overwrite: boolean) => void) | ((doc: CodeMirror.Doc, event: any) => void)): void {

    for (let cell of this.notebook.widgets) {
      // TODO: use some more intelligent strategy to determine editors to test
      let cm_editor = cell.editor as CodeMirrorEditor;
      // TODO: wrap the handler
      // @ts-ignore
      return cm_editor.editor.on(eventName, handler);
    }
  }

  operation<T>(fn: () => T): T {
    return undefined;
  }

  refresh(): void {
  }

  removeKeyMap(map: string | CodeMirror.KeyMap): void {
  }

  removeLineClass(line: any, where: string, class_?: string): CodeMirror.LineHandle {
    return undefined;
  }

  removeOverlay(mode: any): void {
  }

  scrollIntoView(pos: CodeMirror.Position | null, margin?: number): void;
  scrollIntoView(pos: { left: number; top: number; right: number; bottom: number }, margin?: number): void;
  scrollIntoView(pos: { line: number; ch: number }, margin?: number): void;
  scrollIntoView(pos: { from: CodeMirror.Position; to: CodeMirror.Position }, margin?: number): void;
  scrollIntoView(pos: CodeMirror.Position | null | { left: number; top: number; right: number; bottom: number } | { line: number; ch: number } | { from: CodeMirror.Position; to: CodeMirror.Position }, margin?: number): void {
  }

  scrollTo(x?: number | null, y?: number | null): void {
  }

  setGutterMarker(line: any, gutterID: string, value: HTMLElement | null): CodeMirror.LineHandle {
    return undefined;
  }

  setOption(option: string, value: any): void {
  }

  setSize(width: any, height: any): void {
  }

  setValue(content: string): void {
  }

  startOperation(): void {
  }

  swapDoc(doc: CodeMirror.Doc): CodeMirror.Doc {
    return undefined;
  }

  // @ts-ignore
  toggleComment(options?: CommentOptions): void {
  }

  toggleOverwrite(value?: boolean): void {
  }

  triggerOnKeyDown(event: Event): void {
  }

  // @ts-ignore
  uncomment(from: Position, to: Position, options?: CommentOptions): boolean {
    return false;
  }
}

/*
class NotebookAsSingleIEditor extends CodeMirrorEditor {
  constructor(props: any) {
    //super(props);

  }

}*/

class NotebookAdapter {

  editor: Notebook;
  widget: NotebookPanel;
  connection: LspWsConnection;
  adapter: CodeMirrorAdapterExtension;

  constructor(editor_widget: NotebookPanel, jumper: NotebookJumper, app: JupyterFrontEnd, completion_manager: ICompletionManager) {
    this.widget = editor_widget;
    this.editor = editor_widget.content;

    let cm_editor = new NotebookAsSingleEditor(editor_widget) as CodeMirror.Editor;
    // TODO: reconsider where language, path and cwd belong
    const interval: number = setInterval(()=>{
      // TOOD: only connect when: isVisible && has mime
      // maybe use this.widget.content.rendermime.* ?
      if(!(this.widget.content.isVisible && this.widget.content.widgets.length > 0 && this.widget.content.rendermime.mimeTypes.length && cm_editor.getValue().length > 1)) {

        console.log('Notebook not ready, retrying...');
        return;
      }

      clearInterval(interval);

      let document_path = this.widget.context.path;
      let root_path = PathExt.dirname(document_path);
      let value = jumper.language;
      // TODO
      // this.widget.context.pathChanged
      console.log(root_path)
      console.log(document_path)
      console.log(value)
      console.log(this.editor.widgets.length)
      console.log(cm_editor.getValue().length)
      this.connection = new LspWsConnection({
        serverUri: 'ws://localhost/' + value,
        languageId: value,
        // paths handling needs testing on Windows and with other language servers
        // PathExt.join(root, jumper.cwd)
        // PathExt.join(root, jumper.path)
        rootUri: 'file:///' + root_path,
        documentUri: 'file:///' + document_path,
        documentText: () => cm_editor.getValue(),
      }).connect(new WebSocket('ws://localhost:3000/' + value));

      // @ts-ignore
      this.adapter = new CodeMirrorAdapterExtension(this.connection, {
        quickSuggestionsDelay: 50,
      }, cm_editor);

      // detach the adapters contextmenu for now:
      // @ts-ignore
      //this.adapter.editor.getWrapperElement().removeEventListener('contextmenu', this.adapter.editorListeners.contextmenu);
      // TODO: this needs to await till the notebook is fully loaded

      const cell_to_connector_map: Map<Cell, LSPConnector> = new Map();
      // lazily register completion connectors on cells
      this.widget.content.activeCellChanged.connect((notebook, cell) => {

        // skip if already registered
        if(cell_to_connector_map.has(cell))
          return;

        const connector = new LSPConnector({
          editor: cell.editor,
          connection: this.connection
        });
        completion_manager.register({
          connector,
          editor: cell.editor,
          parent: cell,
        });

      })
    }, 500)
  }
}


class FileEditorAdapter {

  editor: FileEditor;
  widget: IDocumentWidget;
  jumper: FileEditorJumper
  adapter: CodeMirrorAdapterExtension;
  connection: LspWsConnection;
  app: JupyterFrontEnd;

  constructor(editor_widget: IDocumentWidget<FileEditor>, jumper: FileEditorJumper, app: JupyterFrontEnd, completion_manager: ICompletionManager) {
    this.widget = editor_widget;
    this.editor = editor_widget.content;

    this.app = app;
    // let root = PageConfig.getOption('serverRoot');
    let cm_editor = this.editor.editor as CodeMirrorEditor;
    // TODO: reconsider where language, path and cwd belong
    let value = jumper.language;

    this.connection = new LspWsConnection({
      serverUri: 'ws://localhost/' + value,
      languageId: value,
      // paths handling needs testing on Windows and with other language servers
      // PathExt.join(root, jumper.cwd)
      // PathExt.join(root, jumper.path)
      rootUri: 'file:///' + jumper.cwd,
      documentUri: 'file:///' + jumper.path,
      documentText: () => cm_editor.editor.getValue(),
    }).connect(new WebSocket('ws://localhost:3000/' + value));

    // @ts-ignore
    this.adapter = new CodeMirrorAdapterExtension(this.connection, {
      quickSuggestionsDelay: 50,
    }, cm_editor.editor);

    // detach the adapters contextmenu for now:
    // @ts-ignore
    this.adapter.editor.getWrapperElement().removeEventListener('contextmenu', this.adapter.editorListeners.contextmenu);
    // TODO: actually we only need the connection... the tooltips and suggestions will need re-writing to JL standards anyway

    // @ts-ignore
    this.connection.on('goTo', (locations) => {
      // TODO: implement selector for multiple locations
      //  (like when there are multiple definitions or usages)

      let location = locations[0];

      // @ts-ignore
      let uri: string = location.uri;

      let current_uri = this.connection.getDocumentUri();

      // @ts-ignore
      let line = location.range.start.line;
      // @ts-ignore
      let column = location.range.start.character;

      if(uri == current_uri) {
        jumper.jump(
          jumper.getJumpPosition({line: line, column: column})
        );
        return;
      }

      if (uri.startsWith('file://'))
        uri = uri.slice(7);

      console.log(uri);
      jumper.global_jump({
        // TODO: there are many files which are not symlinks
        uri: '.lsp_symlink/' + uri,
        editor_index: 0,
        line: line,
        column: column
      }, true);

    });

    const connector = new LSPConnector({
      editor: this.editor.editor,
      connection: this.connection
    });
    completion_manager.register({
      connector,
      editor: this.editor.editor,
      parent: editor_widget,
    });

    console.log('Connected adapter');
  }

  get path() {
    return this.widget.context.path
  }

  get_doc_position_from_context_menu() : IPosition {
    // get the first node as it gives the most accurate approximation
    let leaf_node = this.app.contextMenuHitTest(() => true);

    let cm_editor = this.editor.editor as CodeMirrorEditor;
    let {left, top} = leaf_node.getBoundingClientRect();

    // @ts-ignore
    let event = this.app._contextMenuEvent;

    // if possible, use more accurate position from the actual event
    // (but this relies on an undocumented and unstable feature)
    if(event !== undefined) {
     left = event.clientX;
     top = event.clientY;
     event.stopPropagation()
    }
    return cm_editor.editor.coordsChar({
      left: left,
      top: top,
    }, 'window');
  }

}

const file_editor_adapters: Map<string, FileEditorAdapter> = new Map();


/**
 * The plugin registration information.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: '@krassowski/jupyterlab-lsp:plugin',
  requires: [IEditorTracker, INotebookTracker, ISettingRegistry, ICommandPalette, IDocumentManager, ICompletionManager],
  activate: (
    app: JupyterFrontEnd,
    fileEditorTracker: IEditorTracker,
    notebookTracker: INotebookTracker,
    settingRegistry: ISettingRegistry,
    palette: ICommandPalette,
    documentManager: IDocumentManager,
    completion_manager: ICompletionManager
  ) => {

    //CodeMirrorExtension.configure();

    fileEditorTracker.widgetUpdated.connect((sender, widget) => {
      console.log(sender)
      console.log(widget)
      // TODO?
      // adapter.remove();
      //connection.close();

    });

    fileEditorTracker.widgetAdded.connect((sender, widget) => {

      let fileEditor = widget.content;

      if (fileEditor.editor instanceof CodeMirrorEditor) {
        let jumper = new FileEditorJumper(widget, documentManager);
        //let extension = new CodeMirrorExtension(fileEditor.editor, jumper);
        let adapter = new FileEditorAdapter(widget, jumper, app, completion_manager);
        file_editor_adapters.set(fileEditor.id, adapter);
        //extension.connect();
      }
    });

    let file_editor_commands = [
      {
        'id': 'lsp_get_definition',
        'execute': (connection: LspWsConnection, position: IPosition) => connection.getDefinition(position),
        'isEnabled': (connection: LspWsConnection) => connection.isDefinitionSupported(),
        'label': 'Jump to definition',
      },
      {
        'id': 'lsp_get_type_definition',
        'execute': (connection: LspWsConnection, position: IPosition) => connection.getTypeDefinition(position),
        'isEnabled': (connection: LspWsConnection) => connection.isTypeDefinitionSupported(),
        'label': 'Highlight type definition',
      },
      {
        'id': 'lsp_get_references',
        'execute': (connection: LspWsConnection, position: IPosition) => connection.getReferences(position),
        'isEnabled': (connection: LspWsConnection) => connection.isReferencesSupported(),
        'label': 'Highlight references',
      }

    ];

    let is_context_menu_over_token = () => {
      let fileEditor = fileEditorTracker.currentWidget.content;
      let adapter = file_editor_adapters.get(fileEditor.id);
      let docPosition = adapter.get_doc_position_from_context_menu();
      if (!docPosition)
        return false;
      let ce_position: CodeEditor.IPosition = {line: docPosition.line, column: docPosition.ch};
      let token = adapter.editor.editor.getTokenForPosition(ce_position);
      return token.value !== '';
    };

    for(let cmd of file_editor_commands) {
      app.commands.addCommand(cmd.id, {
        execute: () => {
          let fileEditor = fileEditorTracker.currentWidget.content;
          let adapter = file_editor_adapters.get(fileEditor.id);
          let docPosition = adapter.get_doc_position_from_context_menu();
          cmd.execute(adapter.connection, docPosition);
        },
        isEnabled: () => {
          let fileEditor = fileEditorTracker.currentWidget.content;
          let adapter = file_editor_adapters.get(fileEditor.id);
          return adapter && adapter.connection && cmd.isEnabled(adapter.connection);
        },
        isVisible: is_context_menu_over_token,
        label: cmd.label
      });

      app.contextMenu.addItem({
        selector: '.jp-FileEditor',
        command: cmd.id
      });
    }
    console.log('aasdde')

    notebookTracker.widgetAdded.connect((sender, widget) => {

      // btw: notebookTracker.currentWidget.content === notebook
      //let jumper = new NotebookJumper(widget, documentManager);
      let notebook = widget.content;
      //if (.editor instanceof CodeMirrorEditor) {
        let jumper = new NotebookJumper(widget, documentManager);
        //let extension = new CodeMirrorExtension(fileEditor.editor, jumper);
        new NotebookAdapter(widget, jumper, app, completion_manager);
        //file_editor_adapters.set(fileEditor.id, adapter);
        //extension.connect();
      //}

      // timeout ain't elegant but the widgets are not populated at the start-up time
      // (notebook.widgets.length === 1) - some time is needed for that,
      // and I can't see any callbacks for cells.

      // more insane idea would be to have it run once every 2 seconds
      // more reasonable thing would be to create a PR with .onAddCell
      setTimeout(() => {
        // now (notebook.widgets.length is likely > 1)
        notebook.widgets.every((cell) => {

          return true
        });
      }, 2000);

      // for that cells which will be added later:
      notebook.activeCellChanged.connect((notebook, cell) => {
        if(cell === undefined)
          return;

      });

    });

    function updateOptions(settings: ISettingRegistry.ISettings): void {
      //let options = settings.composite;
      //Object.keys(options).forEach((key) => {
      //  if (key === 'modifier') {
      //    // let modifier = options[key] as KeyModifier;
      //    CodeMirrorExtension.modifierKey = modifier;
      //  }
      //});
    }

    settingRegistry
      .load(plugin.id)
      .then(settings => {
        updateOptions(settings);
        settings.changed.connect(() => {
          updateOptions(settings);
        });
      })
      .catch((reason: Error) => {
        console.error(reason.message);
      });

    // Add an application command
    const cmdIds = {
      // in future add more commands
      jumpNotebook: 'lsp:notebook-jump',
      jumpFileEditor: 'lsp:file-editor-jump',
    };

    // Add the command to the palette.
    palette.addItem({ command: cmdIds.jumpNotebook, category: 'Notebook Cell Operations' });
    palette.addItem({ command: cmdIds.jumpFileEditor, category: 'Text Editor' });

    function isEnabled(tracker: any) {
      return (): boolean =>
        tracker.currentWidget !== null
        &&
        tracker.currentWidget === app.shell.currentWidget
    }

    app.commands.addCommand(cmdIds.jumpNotebook, {
      label: 'Jump to definition',
      execute: () => {
        let notebook_widget = notebookTracker.currentWidget;
        let notebook = notebook_widget.content;

        let jumper = new NotebookJumper(notebook_widget, documentManager);
        let cell = notebook_widget.content.activeCell;
        let editor = cell.editor;

        let position = editor.getCursorPosition();
        let token = editor.getTokenForPosition(position);

        jumper.jump_to_definition({token, origin: null}, notebook.activeCellIndex)
      },
      isEnabled: isEnabled(notebookTracker)
    });

    app.commands.addCommand(cmdIds.jumpFileEditor, {
      label: 'Jump to definition',
      execute: () => {
        let fileEditorWidget = fileEditorTracker.currentWidget;
        let fileEditor = fileEditorWidget.content;

        let jumper = new FileEditorJumper(fileEditorWidget, documentManager);
        let editor = fileEditor.editor;

        let position = editor.getCursorPosition();
        let token = editor.getTokenForPosition(position);

        jumper.jump_to_definition({token, origin: null})
      },
      isEnabled: isEnabled(fileEditorTracker)
    });

    const bindings = [
      {
        selector: '.jp-Notebook.jp-mod-editMode',
        keys: ['Ctrl Alt B'],
        command: cmdIds.jumpNotebook
      },
      {
        selector: '.jp-FileEditor',
        keys: ['Ctrl Alt B'],
        command: cmdIds.jumpFileEditor
      },
    ];


    bindings.map(binding => app.commands.addKeyBinding(binding));

  },
  autoStart: true
};


/**
 * Export the plugin as default.
 */
export default plugin;
