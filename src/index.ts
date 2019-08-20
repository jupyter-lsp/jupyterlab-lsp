import {JupyterFrontEnd, JupyterFrontEndPlugin} from '@jupyterlab/application';
import {ICommandPalette} from "@jupyterlab/apputils";
import {INotebookTracker, Notebook, NotebookPanel} from "@jupyterlab/notebook";
import {CodeMirrorEditor} from '@jupyterlab/codemirror';
import {FileEditor, IEditorTracker} from '@jupyterlab/fileeditor';
import {ISettingRegistry, PathExt} from '@jupyterlab/coreutils';
import {IDocumentManager} from '@jupyterlab/docmanager';

import {FileEditorJumper} from "@krassowski/jupyterlab_go_to_definition/lib/jumpers/fileeditor";
import {NotebookJumper} from "@krassowski/jupyterlab_go_to_definition/lib/jumpers/notebook";

import 'codemirror/addon/hint/show-hint.css';
import 'codemirror/addon/hint/show-hint';
import '../style/index.css'

import 'lsp-editor-adapter/lib/codemirror-lsp.css';
import {CodeMirrorAdapter, ILspConnection, IPosition, ITextEditorOptions, LspWsConnection} from 'lsp-editor-adapter';
import {IDocumentWidget} from "@jupyterlab/docregistry";
import {CodeEditor} from "@jupyterlab/codeeditor";
import {ICompletionManager} from '@jupyterlab/completer';
import * as lsProtocol from "vscode-languageserver-protocol";
import {LSPConnector} from "./completion";
import {NotebookAsSingleEditor} from "./notebook_mapper";
import {diagnosticSeverityNames} from './lsp';
import {Widget} from '@phosphor/widgets';
import {IRenderMimeRegistry} from "@jupyterlab/rendermime";
import {FreeTooltip} from "./free_tooltip";
import {getModifierState, until_ready} from "./utils";
import {PositionConverter} from "./converter";

import CodeMirror = require("codemirror");


/*
Feedback: anchor - not clear from docs
bundle - very not clear from the docs, interface or better docs would be nice to have
 */

// TODO: settings
const hover_modifier = 'Control';


class CodeMirrorAdapterExtension extends CodeMirrorAdapter {

  private marked_diagnostics: Map<string, CodeMirror.TextMarker> = new Map();
  protected create_tooltip: (markup: lsProtocol.MarkupContent, cm_editor: CodeMirror.Editor, position: CodeMirror.Position) => FreeTooltip;
  private _tooltip: FreeTooltip;
  private show_next_tooltip: boolean;
  private last_hover_response: lsProtocol.Hover;

  constructor(connection: ILspConnection, options: ITextEditorOptions, editor: CodeMirror.Editor, create_tooltip: (markup: lsProtocol.MarkupContent, cm_editor: CodeMirror.Editor, position: CodeMirror.Position) => FreeTooltip) {
    super(connection, options, editor);
    this.create_tooltip = create_tooltip;

    // @ts-ignore
    let listeners = this.editorListeners;

    let wrapper = this.editor.getWrapperElement();
    // detach the adapters contextmenu
    wrapper.removeEventListener('contextmenu', listeners.contextmenu);

    // show hover after pressing the modifier key
    wrapper.addEventListener('keydown', (event: KeyboardEvent) => {
      if(!hover_modifier || getModifierState(event, hover_modifier)) {
        this.show_next_tooltip = true;
        this.handleHover(this.last_hover_response)
      }
    })
  }

  public handleGoTo(locations: any) {
    this.remove_tooltip();

    // do NOT handle GoTo actions here
  }

  public handleCompletion(completions: lsProtocol.CompletionItem[]) {
    // do NOT handle completion here

    // TODO: UNLESS the trigger character was typed!
  };

  protected static get_markup(response: lsProtocol.Hover): lsProtocol.MarkupContent {
    let contents = response.contents;

    // this causes the webpack to fail "Module not found: Error: Can't resolve 'net'" for some reason
    // if (lsProtocol.MarkedString.is(contents))
    ///  contents = [contents];

    if(typeof contents === "string")
      contents = [contents as lsProtocol.MarkedString];

    if(!Array.isArray(contents))
      return contents as lsProtocol.MarkupContent;

    // now we have MarkedString
    let content = contents[0];

    if(typeof content === "string") {
      // coerce to MarkedString  object
      return {
        kind: 'plaintext',
        value: content
      };
    }
    else
      return {
        kind: "markdown",
        value: "```" + content.language + '\n' + content.value + "```"
      }
  }

  protected remove_tooltip() {
    // @ts-ignore
    this._removeHover(); // this removes underlines

    if(this._tooltip !== undefined)
      this._tooltip.dispose();
  }

  public handleHover(response: lsProtocol.Hover) {
    this.remove_tooltip();

    if (!response || !response.contents || (Array.isArray(response.contents) && response.contents.length === 0)) {
      return;
    }

    this.highlight_range(response.range, 'cm-lp-hover-available');

    this.last_hover_response = null;
    if (!this.show_next_tooltip) {
      this.last_hover_response = response;
      return;
    }

    const markup = CodeMirrorAdapterExtension.get_markup(response);
    // @ts-ignore
    let position = this.hoverCharacter;
    // TODO this is where the idea of mapping notebooks with an object pretending to be an editor has a weak side...

    let cm_editor = this.editor;
    if((cm_editor as NotebookAsSingleEditor).get_editor_at !== undefined)
      cm_editor = (cm_editor as NotebookAsSingleEditor).get_editor_at(position as CodeMirror.Position);

    this._tooltip = this.create_tooltip(markup, cm_editor, position);
  }
  protected highlight_range(range: lsProtocol.Range, class_name: string) {
    // @ts-ignore
    let hover_character = this.hoverCharacter as CodeMirror.Position;

    let start: CodeMirror.Position;
    let end: CodeMirror.Position;

    if (range) {
      start = PositionConverter.lsp_to_cm(range.start);
      end = PositionConverter.lsp_to_cm(range.end);
    } else {
      // construct range manually using the token information
      let token = this.editor.getTokenAt(hover_character);
      start = {line: hover_character.line, ch: token.start};
      end = {line: hover_character.line, ch: token.end};
    }

    // @ts-ignore
    this.hoverMarker = this.editor.getDoc().markText(start, end, {
      className: class_name,
    });
  }

  public handleMouseOver(event: MouseEvent) {
    // proceed when no hover modifier or hover modifier pressed
    this.show_next_tooltip = !hover_modifier || getModifierState(event, hover_modifier);

    return super.handleMouseOver(event);
  }

  public handleDiagnostic(response: lsProtocol.PublishDiagnosticsParams) {
    /*
    TODO: the base class has the gutter support, like this
    this.editor.clearGutter('CodeMirror-lsp');
     */

    // Note: no deep equal for Sets or Maps in JS:
    // https://stackoverflow.com/a/29759699
    const markers_to_retain: Set<string> = new Set<string>();

    // add new markers, keep track of the added ones
    let doc = this.editor.getDoc();

    response.diagnostics.forEach((diagnostic: lsProtocol.Diagnostic) => {
      const start = PositionConverter.lsp_to_cm(diagnostic.range.start);
      const end = PositionConverter.lsp_to_cm(diagnostic.range.end);

      const severity = diagnosticSeverityNames[diagnostic.severity];

      // what a pity there is no hash in the standard library...
      // we could use this: https://stackoverflow.com/a/7616484 though it may not be worth it:
      //   the stringified diagnostic objects are only about 100-200 JS characters anyway,
      //   depending on the message length; this could be reduced using some structure-aware
      //   stringifier; such a stringifier could also prevent the possibility of having a false
      //   negative due to a different ordering of keys
      // obviously, the hash would prevent recovery of info from the key.
      let diagnostic_hash = JSON.stringify(diagnostic);
      markers_to_retain.add(diagnostic_hash);

      if(!this.marked_diagnostics.has(diagnostic_hash)) {
        let options: CodeMirror.TextMarkerOptions = {
          title: diagnostic.message + (diagnostic.source ? ' (' + diagnostic.source + ')' : ''),
          className: 'cm-lsp-diagnostic cm-lsp-diagnostic-' + severity,
        };
        let marker;
        try { marker = doc.markText(start, end, options); }
        catch (e) {
          console.warn('Marking inspection (diagnostic text) failed, see following logs (2):');
          console.log(diagnostic);
          console.log(e);
          return;
        }
        this.marked_diagnostics.set(diagnostic_hash, marker);
      }

      /*
      TODO and this:
        const childEl = document.createElement('div');
        childEl.classList.add('CodeMirror-lsp-guttermarker');
        childEl.title = diagnostic.message;
        this.editor.setGutterMarker(start.line, 'CodeMirror-lsp', childEl);
      do we want gutters?
     */
    });

    // TODO: this is not enough; the apparent marker position will change in notebook with every line change
    //  for each marker after the (inserted/removed) line, however those markers should not be invalidated,
    //  i.e. the invalidation should be performed in the cell space, not in the notebook coordinate space.
    // remove the markers which were not included in the new message
    this.marked_diagnostics.forEach((marker: CodeMirror.TextMarker, diagnostic_hash: string) => {
      if(!markers_to_retain.has(diagnostic_hash)) {
        marker.clear();
        this.marked_diagnostics.delete(diagnostic_hash)
      }
    });

  }

}


class NotebookAdapter {

  editor: Notebook;
  widget: NotebookPanel;
  connection: LspWsConnection;
  adapter: CodeMirrorAdapterExtension;
  notebook_as_editor: NotebookAsSingleEditor;
  completion_manager: ICompletionManager;
  // TODO: make jumper optional?
  jumper: NotebookJumper;
  rendermime_registry: IRenderMimeRegistry;

  constructor(editor_widget: NotebookPanel, jumper: NotebookJumper, app: JupyterFrontEnd, completion_manager: ICompletionManager, rendermime_registry: IRenderMimeRegistry) {
    this.widget = editor_widget;
    this.editor = editor_widget.content;
    this.completion_manager = completion_manager;
    this.jumper = jumper;
    this.notebook_as_editor = new NotebookAsSingleEditor(editor_widget);
    this.rendermime_registry = rendermime_registry;
    this.init_once_ready().then()
  }

  is_ready() {
    return (
      this.widget.context.isReady &&
      this.widget.content.isVisible &&
      this.widget.content.widgets.length > 0 &&
      this.notebook_as_editor.getValue().length > 0 &&
      // @ts-ignore
      this.widget.model.metadata.get('language_info').name != ''
    )
  }

  async init_once_ready(){
    let document_path = this.widget.context.path;
    console.log('LSP: waiting for', document_path, 'to fully load');
    await until_ready(this.is_ready.bind(this), -1);
    console.log('LSP:', document_path, 'ready for connection');

    let cm_editor = this.notebook_as_editor as CodeMirror.Editor;
    // TODO: reconsider where language, path and cwd belong

    let root_path = PathExt.dirname(document_path);
    // TODO instead use mime types in servers.yml?
    // @ts-ignore
    let value = this.widget.model.metadata.get('language_info').name;
    // TODO
    // this.widget.context.pathChanged

    // TODO: use native jupyterlab tooltips, fix autocompletion (see how it is done by default), using BOTH kernel and LSP
    //  change style for inspections so that unused variables are greyed out if there is enough info in diagnostics message
    console.log('LSP: will connect using root path:', root_path, 'and language:', value);
    this.connection = new LspWsConnection({
      serverUri: 'ws://localhost/' + value,
      languageId: value,
      // paths handling needs testing on Windows and with other language servers
      // PathExt.join(root, jumper.cwd)
      // PathExt.join(root, jumper.path)
      rootUri: 'file:///' + root_path,
      documentUri: 'file:///' + document_path,
      documentText: this.get_notebook_content.bind(this),
    }).connect(new WebSocket('ws://localhost:3000/' + value));

    // @ts-ignore
    await until_ready(() => this.connection.isConnected, -1, 150);
    console.log('LSP:', document_path, 'connected');

    // @ts-ignore
    this.adapter = new CodeMirrorAdapterExtension(
      this.connection, {
        quickSuggestionsDelay: 50,
      },
      cm_editor,
      (markup: lsProtocol.MarkupContent, cm_editor: CodeMirror.Editor, position: CodeMirror.Position) => {
        const bundle = markup.kind === 'plaintext' ? {'text/plain': markup.value} : {'text/markdown': markup.value};
        const tooltip = new FreeTooltip({
          anchor: this.widget.content,
          bundle: bundle,
          editor: this.notebook_as_editor.cm_editor_to_ieditor.get(cm_editor),
          rendermime: this.rendermime_registry,
          position: PositionConverter.cm_to_jl(this.notebook_as_editor.transform(position)),
          moveToLineEnd: false
        }, );
        Widget.attach(tooltip, document.body);
        return tooltip
      }
    );

    // refresh server held state after every change
    // note this may be changed soon: https://github.com/jupyterlab/jupyterlab/issues/5382#issuecomment-515643504
    this.widget.model.contentChanged.connect(this.refresh_lsp_notebook_image.bind(this));

    // and refresh it after the cell was activated, just to make sure that the first experience is ok
    this.widget.content.activeCellChanged.connect(this.refresh_lsp_notebook_image.bind(this));


    // register completion connectors on cells

    // see https://github.com/jupyterlab/jupyterlab/blob/c0e9eb94668832d1208ad3b00a9791ef181eca4c/packages/completer-extension/src/index.ts#L198-L213
    const cell = this.widget.content.activeCell;
    const connector = new LSPConnector({
      editor: cell.editor,
      connection: this.connection,
      coordinates_transform: (position: CodeMirror.Position) => this.notebook_as_editor.transform_to_notebook(cell, position)
    });
    const handler = this.completion_manager.register({
      connector,
      editor: cell.editor,
      parent: this.widget,
    });
    this.widget.content.activeCellChanged.connect((notebook, cell) => {
      const connector = new LSPConnector({
        editor: cell.editor,
        connection: this.connection,
        coordinates_transform: (position: CodeMirror.Position) => this.notebook_as_editor.transform_to_notebook(cell, position)
      });

      handler.editor = cell.editor;
      handler.connector = connector;

    });
  }

  get_notebook_content() {
    return this.notebook_as_editor.getValue()
  }

  refresh_lsp_notebook_image(slot: any) {
    // TODO this is fired too often currently, debounce!
    this.connection.sendChange()
  }
}


class FileEditorAdapter {

  editor: FileEditor;
  widget: IDocumentWidget;
  jumper: FileEditorJumper;
  adapter: CodeMirrorAdapterExtension;
  connection: LspWsConnection;
  app: JupyterFrontEnd;
  rendermime_registry: IRenderMimeRegistry;

  constructor(editor_widget: IDocumentWidget<FileEditor>, jumper: FileEditorJumper, app: JupyterFrontEnd, completion_manager: ICompletionManager, rendermime_registry: IRenderMimeRegistry) {
    this.widget = editor_widget;
    this.editor = editor_widget.content;
    this.rendermime_registry = rendermime_registry;

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
    this.adapter = new CodeMirrorAdapterExtension(
      this.connection,
      {
        quickSuggestionsDelay: 50,
      },
      cm_editor.editor,
      (markup: lsProtocol.MarkupContent, cm_editor: CodeMirror.Editor, position: CodeMirror.Position) => {
        const bundle = markup.kind === 'plaintext' ? {'text/plain': markup.value} : {'text/markdown': markup.value};
        const tooltip = new FreeTooltip({
          anchor: this.widget.content,
          bundle: bundle,
          editor: this.editor.editor,
          rendermime: rendermime_registry,
          position: PositionConverter.cm_to_jl(position),
          moveToLineEnd: false
        });
        Widget.attach(tooltip, document.body);
        return tooltip
      });

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
      connection: this.connection,
      coordinates_transform: null
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
  requires: [IEditorTracker, INotebookTracker, ISettingRegistry, ICommandPalette, IDocumentManager, ICompletionManager, IRenderMimeRegistry],
  activate: (
    app: JupyterFrontEnd,
    fileEditorTracker: IEditorTracker,
    notebookTracker: INotebookTracker,
    settingRegistry: ISettingRegistry,
    palette: ICommandPalette,
    documentManager: IDocumentManager,
    completion_manager: ICompletionManager,
    rendermime_registry: IRenderMimeRegistry
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
        let adapter = new FileEditorAdapter(widget, jumper, app, completion_manager, rendermime_registry);
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

    notebookTracker.widgetAdded.connect((sender, widget) => {
      // NOTE: assuming that the default cells content factory produces CodeMirror editors(!)
      let jumper = new NotebookJumper(widget, documentManager);
      new NotebookAdapter(widget, jumper, app, completion_manager, rendermime_registry);

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
