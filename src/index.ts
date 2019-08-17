import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { ICommandPalette } from "@jupyterlab/apputils";
import { INotebookTracker } from "@jupyterlab/notebook";
import { CodeMirrorEditor } from '@jupyterlab/codemirror';
import { FileEditor, IEditorTracker } from '@jupyterlab/fileeditor';
import { DataConnector, ISettingRegistry } from '@jupyterlab/coreutils';
import { IDocumentManager } from '@jupyterlab/docmanager';

import { FileEditorJumper } from "@krassowski/jupyterlab_go_to_definition/lib/jumpers/fileeditor";
import { NotebookJumper } from "@krassowski/jupyterlab_go_to_definition/lib/jumpers/notebook";
//import { IGlobalJump } from "@krassowski/jupyterlab_go_to_definition/lib/jump";

import { ReadonlyJSONObject } from '@phosphor/coreutils';

import 'codemirror/addon/hint/show-hint.css';
import 'codemirror/addon/hint/show-hint';

import 'lsp-editor-adapter/lib/codemirror-lsp.css';
import { LspWsConnection, CodeMirrorAdapter, IPosition } from 'lsp-editor-adapter';
import { IDocumentWidget } from "@jupyterlab/docregistry";
import { CodeEditor } from "@jupyterlab/codeeditor";
import { CompletionHandler, ICompletionManager, ContextConnector } from '@jupyterlab/completer';
import * as lsProtocol from "vscode-languageserver-protocol";

/**
 * A LSP connector for completion handlers.
 */
export class LSPConnector extends DataConnector<
  CompletionHandler.IReply,
  void,
  CompletionHandler.IRequest
> {
  /**
   * Create a new LSP connector for completion requests.
   *
   * @param options - The instantiation options for the LSP connector.
   */
  constructor(options: LSPConnector.IOptions) {
    super();
    this._editor = options.editor;
    this._connection = options.connection;
    this._completion_characters = this._connection.getLanguageCompletionCharacters();
    this._context_connector = new ContextConnector({editor: options.editor})
  }

  /**
   * Fetch completion requests.
   *
   * @param request - The completion request text and details.
   */
  fetch(
    request: CompletionHandler.IRequest
  ): Promise<CompletionHandler.IReply> {

    try {
      if (this._completion_characters === undefined)
        this._completion_characters = this._connection.getLanguageCompletionCharacters();

      return Private.hint(this._editor, this._connection, this._completion_characters).catch((e) => {
        console.log(e);
        return this._context_connector.fetch(request)
        }
      )
    }
    catch (e) {
      return this._context_connector.fetch(request)
    }
  }

  private readonly _editor: CodeEditor.IEditor;
  private readonly _connection: LspWsConnection;
  private _completion_characters: Array<string>;
  private _context_connector: ContextConnector;
}

/**
 * A namespace for LSP connector statics.
 */
export namespace LSPConnector {
  /**
   * The instantiation options for cell completion handlers.
   */
  export interface IOptions {
    /**
     * The session used by the LSP connector.
     */
    editor: CodeEditor.IEditor;
    connection: LspWsConnection;
  }
}

function convert_position(position: CodeEditor.IPosition): IPosition {
  return {
    line: position.line,
    ch: position.column
  }
}

async function sleep(timeout: number) {
  return new Promise((resolve) => {
    setTimeout(() => {resolve()}, timeout);
  })
}

function once_set(x: any, max_retrials: number=35) {
  return new Promise(async (resolve, reject) => {
    let i = 0;
    while (x.set !== true) {
      i += 1;
      if(i > max_retrials) {
        reject('Too many retrials');
        break
      }
      console.log('waiting');
      await sleep(50)
    }
    resolve(x.value);
  });
}

interface IItemType extends ReadonlyJSONObject {
  // the item value
  text: string
  // the item type
  type: string
}

// LSP defaults
namespace CompletionItemKind {
	export const Text = 1;
	export const Method = 2;
	export const Function = 3;
	export const Constructor = 4;
	export const Field = 5;
	export const Variable = 6;
	export const Class = 7;
	export const Interface = 8;
	export const Module = 9;
	export const Property = 10;
	export const Unit = 11;
	export const Value = 12;
	export const Enum = 13;
	export const Keyword = 14;
	export const Snippet = 15;
	export const Color = 16;
	export const File = 17;
	export const Reference = 18;
	export const Folder = 19;
	export const EnumMember = 20;
	export const Constant = 21;
	export const Struct = 22;
	export const Event = 23;
	export const Operator = 24;
	export const TypeParameter = 25;
}

const itemKinds: Record<number, string> = {};
for(let key of Object.keys(CompletionItemKind)) {
  // @ts-ignore
  itemKinds[CompletionItemKind[key]] = key;
}

/**
 * A namespace for Private functionality.
 */
namespace Private {
  /**
   * Get a list of completion hints from a tokenization
   * of the editor.
   */
  export async function hint(
    editor: CodeEditor.IEditor,
    connection: LspWsConnection,
    completion_characters: Array<string>
  ): Promise<CompletionHandler.IReply> {
    // Find the token at the cursor
    const cursor = editor.getCursorPosition();
    const token = editor.getTokenForPosition(cursor);

    const start = editor.getPositionAt(token.offset);
    const end = editor.getPositionAt(token.offset + token.value.length);

    // const signatureCharacters = connection.getLanguageSignatureCharacters();

    const typedCharacter = token.value[cursor.column - start.column - 1];

    // without sendChange we (sometimes) get outdated suggestions
    connection.sendChange();

    //let request_completion: Function;
    let event: string;

    // nope - do not do this; we need to get the signature (yes)
    // but only in order to bump the priority of the parameters!
    // unfortunately there is no abstraction of scores exposed
    // to the matches...
    // Suggested in https://github.com/jupyterlab/jupyterlab/issues/7044, TODO PR


    //if (signatureCharacters.indexOf(typedCharacter) !== -1) {
    //  // @ts-ignore
    //  request_completion = connection.getSignatureHelp.bind(this);
    //  event = 'signature'
    //} else {
      // @ts-ignore
      //request_completion = connection.getCompletion.bind(this);
      event = 'completion';
    //}
    //*/

    // todo: regexpr?
    //if(completion_characters.indexOf(typedCharacter) === -1)
    //  return

    // in Node v11.13.0, once() was added which would enable using native promises here:
    // https://nodejs.org/api/events.html#events_events_once_emitter_name
    // but it has not been implemented in 'events':
    // https://nodejs.org/api/events.html
    // yet (as for today they match Node.js v10.1)
    // There is an issue:
    // https://github.com/Gozala/events/issues/63

    connection.getCompletion(
      convert_position(cursor),
      {
        start: convert_position(start),
        end: convert_position(end),
        text: token.value
      },
      //completion_characters.find((c) => c === typedCharacter)
      typedCharacter,
      //lsProtocol.CompletionTriggerKind.TriggerCharacter,
    );
    let result: any = {set: false};
    connection.once(event, (args: any) => {
      result.value = args;
      result.set = true;
      return args
    });
    await once_set(result);

    console.log(result);

    let matches: Array<string> = [];
    const types: Array<IItemType> = [];

    let no_prefix = true;
    for(let match of result.value) {
      // there are more interesting things to be extracted and passed to the metadata:
      // detail: "__main__"
      // documentation: "mean(data)↵↵Return the sample arithmetic mean of data.↵↵>>> mean([1, 2, 3, 4, 4])↵2.8↵↵>>> from fractions import Fraction as F↵>>> mean([F(3, 7), F(1, 21), F(5, 3), F(1, 3)])↵Fraction(13, 21)↵↵>>> from decimal import Decimal as D↵>>> mean([D("0.5"), D("0.75"), D("0.625"), D("0.375")])↵Decimal('0.5625')↵↵If ``data`` is empty, StatisticsError will be raised."
      // insertText: "mean"
      // kind: 3
      // label: "mean(data)"
      // sortText: "amean"
      let text = match.insertText ? match.insertText : match.label;
      if (text.toLowerCase().startsWith(token.value.toLowerCase())) {
        no_prefix = false;
      }

      matches.push(text);
      types.push({
        text: text,
        type: match.kind ? itemKinds[match.kind] : ''
      })
    }
    console.log(matches)
    console.log(types)

    return {
      // note in the ContextCompleter it was:
      // start: token.offset,
      // end: token.offset + token.value.length,
      // which does not work with "from statistics import <tab>" as the last token ends at "t" of "import",
      // so the completer would append "mean" as "from statistics importmean" (without space!);
      // (in such a case the typedCharacters is undefined as we are out of range)
      // a different workaround would be to prepend the token.value prefix:
      // text = token.value + text;
      // but it did not work for "from statistics <tab>" and lead to "from statisticsimport" (no space)
      start: no_prefix ? token.offset + token.value.length : token.offset,
      end: token.offset + token.value.length,
      matches: matches,
      metadata: {
        _jupyter_types_experimental: types
      }
    };
  }

}

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


class FileEditorAdapter {

  editor: FileEditor;
  widget: IDocumentWidget;
  jumper: FileEditorJumper;
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
      quickSuggestionsDelay: 10,
    }, cm_editor.editor);

    // detach the adapters contextmenu for now:
    // @ts-ignore
    this.adapter.editor.getWrapperElement().removeEventListener('contextmenu', this.adapter.editorListeners.contextmenu);
    // TODO: actually we only need the connection... the tooltips and suggestions will need re-writing to JL standards anyway

    // @ts-ignore
    this.connection.on('goTo', (locations) => {
      // TODO: implement selector for multiple locations

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

    notebookTracker.widgetAdded.connect((sender, widget) => {

      // btw: notebookTracker.currentWidget.content === notebook
      //let jumper = new NotebookJumper(widget, documentManager);
      let notebook = widget.content;

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
