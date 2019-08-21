import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICommandPalette } from '@jupyterlab/apputils';
import { INotebookTracker } from '@jupyterlab/notebook';
import { CodeMirrorEditor } from '@jupyterlab/codemirror';
import { IEditorTracker } from '@jupyterlab/fileeditor';
import { ISettingRegistry } from '@jupyterlab/coreutils';
import { IDocumentManager } from '@jupyterlab/docmanager';

import { FileEditorJumper } from '@krassowski/jupyterlab_go_to_definition/lib/jumpers/fileeditor';
import { NotebookJumper } from '@krassowski/jupyterlab_go_to_definition/lib/jumpers/notebook';

import 'codemirror/addon/hint/show-hint.css';
import 'codemirror/addon/hint/show-hint';
import '../style/index.css';

import 'lsp-editor-adapter/lib/codemirror-lsp.css';
import { IPosition, LspWsConnection } from 'lsp-editor-adapter';
import { ICompletionManager } from '@jupyterlab/completer';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { NotebookAdapter } from './adapters/notebook';
import { FileEditorAdapter } from './adapters/file_editor';
import { JupyterLabWidgetAdapter } from './adapters/jupyterlab';

const file_editor_adapters: Map<string, FileEditorAdapter> = new Map();
const notebook_adapters: Map<string, NotebookAdapter> = new Map();

const lsp_commands = [
  {
    id: 'lsp_get_definition',
    execute: (connection: LspWsConnection, position: IPosition) =>
      connection.getDefinition(position),
    isEnabled: (connection: LspWsConnection) =>
      connection.isDefinitionSupported(),
    label: 'Jump to definition'
  },
  {
    id: 'lsp_get_type_definition',
    execute: (connection: LspWsConnection, position: IPosition) =>
      connection.getTypeDefinition(position),
    isEnabled: (connection: LspWsConnection) =>
      connection.isTypeDefinitionSupported(),
    label: 'Highlight type definition'
  },
  {
    id: 'lsp_get_references',
    execute: (connection: LspWsConnection, position: IPosition) =>
      connection.getReferences(position),
    isEnabled: (connection: LspWsConnection) =>
      connection.isReferencesSupported(),
    label: 'Highlight references'
  }
];

function is_context_menu_over_token(adapter: JupyterLabWidgetAdapter) {
  let docPosition = adapter.get_doc_position_from_context_menu();
  if (!docPosition) {
    return false;
  }
  let token = adapter.cm_editor.getTokenAt(docPosition);
  return token.string !== '';
}

/**
 * The plugin registration information.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: '@krassowski/jupyterlab-lsp:plugin',
  requires: [
    IEditorTracker,
    INotebookTracker,
    ISettingRegistry,
    ICommandPalette,
    IDocumentManager,
    ICompletionManager,
    IRenderMimeRegistry
  ],
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
    fileEditorTracker.widgetUpdated.connect((sender, widget) => {
      console.log(sender);
      console.log(widget);
      // TODO?
      // adapter.remove();
      // connection.close();
    });

    fileEditorTracker.widgetAdded.connect((sender, widget) => {
      let fileEditor = widget.content;

      if (fileEditor.editor instanceof CodeMirrorEditor) {
        let jumper = new FileEditorJumper(widget, documentManager);
        let adapter = new FileEditorAdapter(
          widget,
          jumper,
          app,
          completion_manager,
          rendermime_registry
        );
        file_editor_adapters.set(fileEditor.id, adapter);
      }
    });

    let is_context_menu_over_file_editor_token = () => {
      let fileEditor = fileEditorTracker.currentWidget.content;
      let adapter = file_editor_adapters.get(fileEditor.id);
      return is_context_menu_over_token(adapter);
    };

    for (let cmd of lsp_commands) {
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
          return (
            adapter && adapter.connection && cmd.isEnabled(adapter.connection)
          );
        },
        isVisible: is_context_menu_over_file_editor_token,
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
      let adapter = new NotebookAdapter(
        widget,
        jumper,
        app,
        completion_manager,
        rendermime_registry
      );
      notebook_adapters.set(widget.id, adapter);
    });

    // TODO de-duplicate commands creation, use some kind of an interface or factory
    let is_context_menu_over_notebook_token = () => {
      let notebook = notebookTracker.currentWidget;
      let adapter = notebook_adapters.get(notebook.id);
      return is_context_menu_over_token(adapter);
    };

    // position context menu entries after 10th but before 11th default entry
    // this lets it be before "Clear outputs" which is the last entry of the
    // CodeCell contextmenu and plays nicely with the first notebook entry
    // ('Clear all outputs') thus should stay as the last one.
    // TODO: PR bumping rank of clear all outputs instead?
    app.contextMenu.addItem({
      type: 'separator',
      selector: '.jp-Notebook .jp-CodeCell',
      rank: 10 + 1 / (lsp_commands.length + 2)
    });
    let i = 1;
    for (let cmd of lsp_commands) {
      i += 1;
      app.commands.addCommand(cmd.id + '_notebook', {
        execute: () => {
          let notebook = notebookTracker.currentWidget;
          let adapter = notebook_adapters.get(notebook.id);
          let docPosition = adapter.get_doc_position_from_context_menu();
          cmd.execute(adapter.connection, docPosition);
        },
        isEnabled: () => {
          let notebook = notebookTracker.currentWidget;
          let adapter = notebook_adapters.get(notebook.id);
          return (
            adapter && adapter.connection && cmd.isEnabled(adapter.connection)
          );
        },
        isVisible: is_context_menu_over_notebook_token,
        label: cmd.label
      });
      app.contextMenu.addItem({
        selector: '.jp-Notebook .jp-CodeCell',
        command: cmd.id + '_notebook',
        rank: 10 + i / (lsp_commands.length + 2)
      });
    }

    function updateOptions(settings: ISettingRegistry.ISettings): void {
      // let options = settings.composite;
      // Object.keys(options).forEach((key) => {
      //  if (key === 'modifier') {
      //    // let modifier = options[key] as KeyModifier;
      //    CodeMirrorExtension.modifierKey = modifier;
      //  }
      // });
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

    /*
    // Add an application command
    const cmdIds = {
      // in future add more commands
      jumpNotebook: 'lsp:notebook-jump',
      jumpFileEditor: 'lsp:file-editor-jump'
    };

    // Add the command to the palette.
    palette.addItem({
      command: cmdIds.jumpNotebook,
      category: 'Notebook Cell Operations'
    });
    palette.addItem({
      command: cmdIds.jumpFileEditor,
      category: 'Text Editor'
    });

    function isEnabled(tracker: any) {
      return (): boolean =>
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget;
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

        jumper.jump_to_definition(
          { token, origin: null },
          notebook.activeCellIndex
        );
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

        jumper.jump_to_definition({ token, origin: null });
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
      }
    ];

    bindings.map(binding => app.commands.addKeyBinding(binding));
    */
  },
  autoStart: true
};

/**
 * Export the plugin as default.
 */
export default plugin;
