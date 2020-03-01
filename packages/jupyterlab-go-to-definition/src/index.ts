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

import { FileEditorJumper } from './jumpers/fileeditor';
import { NotebookJumper } from './jumpers/notebook';

import { CodeMirrorExtension } from './editors/codemirror';
import { KeyModifier } from './editors/editor';

/**
 * The plugin registration information.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: '@krassowski/jupyterlab_go_to_definition:plugin',
  requires: [
    IEditorTracker,
    INotebookTracker,
    ISettingRegistry,
    ICommandPalette,
    IDocumentManager
  ],
  activate: (
    app: JupyterFrontEnd,
    fileEditorTracker: IEditorTracker,
    notebookTracker: INotebookTracker,
    settingRegistry: ISettingRegistry,
    palette: ICommandPalette,
    documentManager: IDocumentManager
  ) => {
    CodeMirrorExtension.configure();

    fileEditorTracker.widgetAdded.connect((sender, widget) => {
      let fileEditor = widget.content;

      if (fileEditor.editor instanceof CodeMirrorEditor) {
        let jumper = new FileEditorJumper(widget, documentManager);
        let extension = new CodeMirrorExtension(fileEditor.editor, jumper);

        extension.connect();
      }
    });

    notebookTracker.widgetAdded.connect((sender, widget) => {
      // btw: notebookTracker.currentWidget.content === notebook
      let jumper = new NotebookJumper(widget, documentManager);
      let notebook = widget.content;

      // timeout ain't elegant but the widgets are not populated at the start-up time
      // (notebook.widgets.length === 1) - some time is needed for that,
      // and I can't see any callbacks for cells.

      // more insane idea would be to have it run once every 2 seconds
      // more reasonable thing would be to create a PR with .onAddCell
      setTimeout(() => {
        // now (notebook.widgets.length is likely > 1)
        notebook.widgets.every(cell => {
          let codemirror_editor = cell.editor as CodeMirrorEditor;
          let extension = new CodeMirrorExtension(codemirror_editor, jumper);

          extension.connect();

          return true;
        });
      }, 2000);

      // for that cells which will be added later:
      notebook.activeCellChanged.connect((notebook, cell) => {
        if (cell === undefined) return;

        let codemirror_editor = cell.editor as CodeMirrorEditor;
        let extension = new CodeMirrorExtension(codemirror_editor, jumper);

        extension.connect();
      });
    });

    function updateOptions(settings: ISettingRegistry.ISettings): void {
      let options = settings.composite;
      Object.keys(options).forEach(key => {
        if (key === 'modifier') {
          let modifier = options[key] as KeyModifier;
          CodeMirrorExtension.modifierKey = modifier;
        }
      });
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
      jumpNotebook: 'go-to-definition:notebook',
      jumpFileEditor: 'go-to-definition:file-editor',
      jumpBackNotebook: 'go-to-definition:notebook-back',
      jumpBackFileEditor: 'go-to-definition:file-editor-back'
    };

    // Add the command to the palette.
    palette.addItem({
      command: cmdIds.jumpNotebook,
      category: 'Notebook Cell Operations'
    });
    palette.addItem({
      command: cmdIds.jumpBackNotebook,
      category: 'Notebook Cell Operations'
    });
    palette.addItem({
      command: cmdIds.jumpFileEditor,
      category: 'Text Editor'
    });
    palette.addItem({
      command: cmdIds.jumpBackFileEditor,
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

    app.commands.addCommand(cmdIds.jumpBackNotebook, {
      label: 'Jump back',
      execute: () => {
        let notebook_widget = notebookTracker.currentWidget;

        let jumper = new NotebookJumper(notebook_widget, documentManager);
        jumper.jump_back();
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

    app.commands.addCommand(cmdIds.jumpBackFileEditor, {
      label: 'Jump back',
      execute: () => {
        let fileEditorWidget = fileEditorTracker.currentWidget;

        let jumper = new FileEditorJumper(fileEditorWidget, documentManager);
        jumper.jump_back();
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
        selector: '.jp-Notebook',
        keys: ['Alt O'],
        command: cmdIds.jumpBackNotebook
      },
      {
        selector: '.jp-FileEditor',
        keys: ['Ctrl Alt B'],
        command: cmdIds.jumpFileEditor
      },
      {
        selector: '.jp-FileEditor',
        keys: ['Alt O'],
        command: cmdIds.jumpBackFileEditor
      }
    ];

    bindings.map(binding => app.commands.addKeyBinding(binding));
  },
  autoStart: true
};

/**
 * Export the plugin as default.
 */
export default plugin;
