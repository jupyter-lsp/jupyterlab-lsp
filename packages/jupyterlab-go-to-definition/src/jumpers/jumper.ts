import { CodeMirrorEditor } from '@jupyterlab/codemirror';
import { CodeEditor } from '@jupyterlab/codeeditor';

import { IGlobalJump, IJump, IJumpPosition } from '../jump';
import { chooseLanguageAnalyzer } from '../languages/chooser';
import { CodeMirrorExtension } from '../editors/codemirror';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { LanguageAnalyzer, TokenContext } from '../languages/analyzer';
import { Kernel, KernelMessage } from '@jupyterlab/services';
import IIOPubMessage = KernelMessage.IIOPubMessage;
import { IDocumentWidget } from '@jupyterlab/docregistry';
import { JumpHistory } from '../history';
import { FileEditor } from '@jupyterlab/fileeditor';
import IEditor = CodeEditor.IEditor;
import { Dialog, showDialog } from '@jupyterlab/apputils';

function hasCellMagic(tokens: CodeEditor.IToken[]) {
  return (
    // CodeMirror Python-tokenizer
    (tokens.length >= 3 && tokens[0].value == '%' && tokens[1].value == '%') ||
    // CodeMirror R-tokenizer: although IRkernel does not support magics,
    // cell-magic recognition is still needed whe operating on an R-cell
    // inside of IPython notebook.
    (tokens.length >= 2 && tokens[0].value == '%%')
  );
}

const cell_magic_lang_to_tokenizer: any = {
  // on the right-hand side is the CodeMirror mode specification
  // TODO: new class for mode spec?
  bash: 'bash',
  R: 'r',
  python: 'python',
  python2: { name: 'python', version: 2 },
  python3: { name: 'python', version: 3 },
  javascript: 'javascript',
  js: 'javascript',
  svg: 'application/xml',
  html: 'text/html',
  latex: 'text/x-stex'
  // not working as for now:
  // 'ruby': 'text/x-ruby',
  // require additional logic/scripting:
  // 'script': '',
  // 'sh': '',
};

const movement_keys = [
  'ArrowRight',
  'ArrowLeft',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown'
];

const modifiers = ['Alt', 'AltGraph', 'Control', 'Shift'];

const system_keys = [
  'F1',
  'F2',
  'F3',
  'F4',
  ' F5',
  'F6',
  'F7',
  'F8',
  'F9',
  'F10',
  'F11',
  'F12',
  'ContextMenu'
];

export abstract class CodeJumper {
  abstract language: string;

  document_manager: IDocumentManager;
  widget: IDocumentWidget;

  history: JumpHistory;

  abstract jump_to_definition(jump: IJump): void;

  abstract get editors(): ReadonlyArray<CodeEditor.IEditor>;

  protected _getLanguageAnalyzerForCell(cell_editor: CodeEditor.IEditor) {
    let language = this.language;

    // if a cell starts with %%[language] magic, use the other language:
    let tokens = cell_editor.getTokens();

    // TODO: move this out to a separate jupyterlab-extension?
    //  this could be run after each change of cell content

    if (hasCellMagic(tokens)) {
      let magic_name =
        tokens[0].value == '%' ? tokens[2].value : tokens[1].value;
      if (cell_magic_lang_to_tokenizer.hasOwnProperty(magic_name)) {
        language = magic_name;
        // to get properly parsed tokens for given language,
        // force the CodeMirror tokenizer to use the corresponding mode
        let cm = cell_editor as CodeMirrorEditor;
        cm.editor.setOption('mode', cell_magic_lang_to_tokenizer[language]);
      }
    }

    let analyzerClass = chooseLanguageAnalyzer(language);

    // TODO: make this dynamic, depending on editor implementation in use (like with languages)
    let editor = new CodeMirrorExtension(cell_editor as CodeMirrorEditor, this);

    return new analyzerClass(editor);
  }

  /**
   * Find the last definition of given variable.
   */
  protected _findLastDefinition(token: CodeEditor.IToken, stopIndex: number) {
    let definitionToken = null;
    let definitionIndex = null;
    const originToken = token;

    for (let i = 0; i <= stopIndex; i++) {
      let cell_editor = this.editors[i];

      let analyzer = this._getLanguageAnalyzerForCell(cell_editor);

      // try to find variable assignment
      let definitions = analyzer.getDefinitions(token.value);

      if (definitions.length) {
        // Get definitions / assignments that appear before
        // token of origin (are in an earlier cells or have lower offset),
        let in_earlier_cell = i < stopIndex;
        let filtered = in_earlier_cell
          ? definitions // all are in an earlier cell
          : definitions.filter(
              otherToken => otherToken.offset < originToken.offset
            ); // all are in same cell

        // but ignore ones that are part of the same assignment expression,
        // for example in a cell like this:
        // >>> a = 1
        // >>> a = a + 1
        // clicking on the last 'a' should jump to the first line,
        // and not to beginning of the second line.
        filtered = filtered.filter(otherToken => {
          // If otherToken is in previous cell, we don't need to worry.
          if (i < stopIndex) {
            return true;
          }

          return !analyzer.isTokenInSameAssignmentExpression(otherToken, token);
        });

        if (filtered.length) {
          definitionToken = filtered[filtered.length - 1];
          definitionIndex = i;
        } else if (!definitionToken && i === stopIndex) {
          // but if there is no definition at all, and we are in the last cell,
          // just return the token of origin (the clicked element), so the
          // editor will focus on the clicked element rather than ignore the
          // click altogether.
          definitionToken = token;
          definitionIndex = i;
        }
      }
    }
    return {
      token: definitionToken,
      cellIndex: definitionIndex
    };
  }

  private go_to_position(
    document_widget: IDocumentWidget,
    jumper: string,
    column: number,
    line_number: number,
    input_number = 0
  ) {
    let document_jumper: CodeJumper;
    let position = { line: line_number, column: column };
    let document_jumper_type = jumpers.get(jumper);

    document_jumper = new document_jumper_type(
      document_widget,
      this.document_manager
    );
    let jump_position = document_jumper.getJumpPosition(position, input_number);
    document_jumper.jump(jump_position);
  }

  public global_jump(position: IGlobalJump, is_symlink = false) {
    let document_widget = this.document_manager.openOrReveal(position.uri);

    document_widget.revealed.then(() => {
      this.go_to_position(
        document_widget,
        'fileeditor',
        position.column,
        position.line,
        position.editor_index
      );

      // protect external files from accidental edition
      if (is_symlink) {
        let editor_widget = document_widget as IDocumentWidget<FileEditor>;
        editor_widget.title.label = editor_widget.title.label + ' (external)';
        let editor = editor_widget.content.editor;
        let disposable = editor.addKeydownHandler(
          (editor: IEditor, event: KeyboardEvent) => {
            // allow to move around, select text and use modifiers & browser keys freely
            if (
              movement_keys.indexOf(event.key) !== -1 ||
              modifiers.indexOf(event.key) !== -1 ||
              system_keys.indexOf(event.key) !== -1
            ) {
              return false;
            }

            // allow to copy text (here assuming that, as on majority of OSs, copy is associated with ctrl+c)
            // this is not foolproof, but should work in majority of sane settings (unfortunately, not in vim)
            if (event.key == 'c' && event.ctrlKey) return false;

            let dialog_promise = showDialog({
              title: 'Edit external file?',
              body:
                'This file is located outside of the root of the JupyterLab start directory. ' +
                'do you really wish to edit it?',
              buttons: [
                Dialog.cancelButton({ label: 'Cancel' }),
                Dialog.warnButton({ label: 'Edit anyway' })
              ]
            });

            dialog_promise.then(result => {
              if (result.button.accept) disposable.dispose();
            });

            // prevent default
            return true;
          }
        );
      }
    });
  }

  try_to_open_document(
    path: string,
    is_symlink: boolean,
    line_number = 0,
    input_number: number = null,
    column: number = 0
  ) {
    if (input_number && !path && this.constructor.name === 'NotebookJumper') {
      // the definition is in this notebook

      this.go_to_position(
        this.widget,
        'notebook',
        column,
        line_number,
        input_number
      );
    } else {
      this.document_manager.services.contents
        .get(path, { content: false })
        .then(() => {
          this.global_jump(
            {
              editor_index: input_number,
              line: line_number,
              column: column,
              uri: path
            },
            is_symlink
          );
        })
        .catch(() => {});
    }
  }

  handle_path_from_kernel(response: IIOPubMessage, fallback_paths: string[]) {
    let obj: any = response.content;
    if (obj.name === 'stdout') {
      let data = JSON.parse(obj.text);
      this.try_to_open_document(data['path'], data['is_symlink']);
    } else if (response.header.msg_type === 'error') {
      console.error(
        'Failed to resolve the paths from kernel; falling back to guessing the path locations'
      );
      console.log(response);
      for (let path of fallback_paths) {
        this.try_to_open_document(path, false);
      }
    }
  }

  get kernel(): Kernel.IKernelConnection {
    return null;
  }

  abstract get cwd(): string;

  queryKernel(
    code: string,
    kernel: Kernel.IKernelConnection,
    callback: (msg: KernelMessage.IIOPubMessage) => any
  ) {
    let request = { code: code, stop_on_error: false, silent: true };
    kernel.ready.then(() => {
      let future = kernel.requestExecute(request);

      future.onIOPub = callback;

      return future.done;
    });
  }

  protected jump_to_cross_file_reference(
    context: TokenContext,
    cell_of_origin_analyzer: LanguageAnalyzer
  ) {
    let potential_paths = cell_of_origin_analyzer.guessReferencePath(context);
    if (this.cwd) {
      let prefixed_with_cwd = potential_paths.map(
        path => this.cwd + '/' + path
      );
      potential_paths = prefixed_with_cwd.concat(potential_paths);
    }

    let code = cell_of_origin_analyzer.referencePathQuery(context);

    if (cell_of_origin_analyzer.supportsKernel && this.kernel && code) {
      this.queryKernel(
        code,
        this.kernel,
        msg => this.handle_path_from_kernel(msg, potential_paths) // TODO: extract fallback?
      );
    } else {
      // TODO: extract fallback?
      // if kernel is not available, try use the guessed paths
      // try one by one
      for (let path of potential_paths) {
        this.try_to_open_document(path, false);
      }
    }
  }

  handle_kernel_inspect(response: IIOPubMessage, fallback: Function) {
    let obj: any = response.content;
    if (obj.name === 'stdout') {
      let data = JSON.parse(obj.text);
      if (!data) {
        // not a definition that the server can resolve, carry on
        fallback();
      }
      let line_number = data['line_number'];
      this.try_to_open_document(
        data['path'],
        data['is_symlink'],
        line_number - 1,
        data['input_number'],
        data['column']
      );
    } else if (response.header.msg_type === 'error') {
      console.error(
        'Failed to resolve the paths from kernel; falling back to guessing the path locations'
      );
      console.log(response);
      fallback();
    }
  }

  protected inspect_and_jump(
    context: TokenContext,
    cell_of_origin_analyzer: LanguageAnalyzer,
    fallback: Function,
    callback: Function
  ) {
    let code = cell_of_origin_analyzer.definitionLocationQuery(context);

    if (cell_of_origin_analyzer.supportsKernel && this.kernel && code) {
      this.queryKernel(code, this.kernel, msg =>
        this.handle_kernel_inspect(msg, fallback)
      );
    } else {
      fallback();
    }

    // TODO: rewrite with promises, make sure that we do not call callback if the jump failed
    callback();
  }

  abstract jump(position: IJumpPosition): void;

  abstract getOffset(position: CodeEditor.IPosition, cell?: number): number;

  abstract getJumpPosition(
    position: CodeEditor.IPosition,
    input_number?: number
  ): IJumpPosition;
}

export let jumpers: Map<string, any> = new Map();
