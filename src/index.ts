import {JupyterFrontEnd, JupyterFrontEndPlugin} from '@jupyterlab/application';
import {ICommandPalette} from "@jupyterlab/apputils";
import {INotebookTracker} from "@jupyterlab/notebook";
import {CodeMirrorEditor} from '@jupyterlab/codemirror';
import {IEditorTracker} from '@jupyterlab/fileeditor';
import {ISettingRegistry} from '@jupyterlab/coreutils';
import {IDocumentManager} from '@jupyterlab/docmanager';

import {FileEditorJumper} from "@krassowski/jupyterlab_go_to_definition/lib/jumpers/fileeditor";
import {NotebookJumper} from "@krassowski/jupyterlab_go_to_definition/lib/jumpers/notebook";

import 'codemirror/addon/hint/show-hint.css';
import 'codemirror/addon/hint/show-hint';
import '../style/index.css'

import 'lsp-editor-adapter/lib/codemirror-lsp.css';
import {IPosition, LspWsConnection} from 'lsp-editor-adapter';
import {CodeEditor} from "@jupyterlab/codeeditor";
import {ICompletionManager} from '@jupyterlab/completer';
import {IRenderMimeRegistry} from "@jupyterlab/rendermime";
import {NotebookAdapter} from "./adapters/notebook";
import {FileEditorAdapter} from "./adapters/file_editor";


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
