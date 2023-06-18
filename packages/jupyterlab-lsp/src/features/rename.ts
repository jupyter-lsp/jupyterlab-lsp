import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
} from '@jupyterlab/application';
import { InputDialog, Notification, ICommandPalette } from '@jupyterlab/apputils';
import {
  ITranslator,
  nullTranslator,
  TranslationBundle
} from '@jupyterlab/translation';
import { LabIcon } from '@jupyterlab/ui-components';
import * as lsProtocol from 'vscode-languageserver-protocol';

import renameSvg from '../../style/icons/rename.svg';
import {
  IEditOutcome
} from '../editor_integration/codemirror';
import { Feature } from '../feature';
import { PLUGIN_ID } from '../tokens';
import { ILSPFeatureManager, ILSPDocumentConnectionManager, WidgetLSPAdapter } from '@jupyterlab/lsp';
import { BrowserConsole } from '../virtual/console';
import { ContextAssembler } from '../command_manager';
import { PositionConverter } from '../converter';

import { ILSPDocumentConnectionManager as ILSPDocumentConnectionManagerDownstream } from '../connection_manager'


export const renameIcon = new LabIcon({
  name: 'lsp:rename',
  svgstr: renameSvg
});

const FEATURE_ID = PLUGIN_ID + ':rename';

export class RenameFeature extends Feature {
  readonly id = RenameFeature.id;
  readonly capabilities: lsProtocol.ClientCapabilities = {
    textDocument: {
      rename: {
        prepareSupport: false,
        honorsChangeAnnotations: false
      }
    }
  }
  protected console = new BrowserConsole().scope('Rename');

  private _trans: TranslationBundle;

  constructor(options: RenameFeature.IOptions) {
    super(options);
    this._trans = options.trans;
  }

  async handleRename(
    workspaceEdit: lsProtocol.WorkspaceEdit,
    oldValue: string,
    newValue: string,
    adapter: WidgetLSPAdapter<any>
  ) {
    let outcome: IEditOutcome;

    try {
      outcome = await this.apply_edit(workspaceEdit);
    } catch (error) {
      Notification.emit(this._trans.__('Rename failed: %1', error), 'error');
      return;
    }

    try {
      let status: string;
      const change_text = this._trans.__('%1 to %2', oldValue, newValue);
      let severity: 'success' | 'warning' | 'error' = 'success';

      if (outcome.appliedChanges === 0) {
        status = this._trans.__(
          'Could not rename %1 - consult the language server documentation',
          change_text
        );
        severity = 'warning';
      } else if (outcome.wasGranular) {
        status = this._trans._n(
          'Renamed %2 in %3 place',
          'Renamed %2 in %3 places',
          outcome.appliedChanges!,
          change_text,
          outcome.appliedChanges
        );
      } else if (adapter.hasMultipleEditors) {
        status = this._trans._n(
          'Renamed %2 in %3 cell',
          'Renamed %2 in %3 cells',
          outcome.modifiedCells,
          change_text,
          outcome.modifiedCells
        );
      } else {
        status = this._trans.__('Renamed %1', change_text);
      }

      if (outcome.errors.length !== 0) {
        status += this._trans.__(' with errors: %1', outcome.errors);
        severity = 'error';
      }

      Notification.emit(status, severity);
    } catch (error) {
      this.console.warn(error);
    }

    return outcome;
  }

  /**
   * In #115 an issue with rename for Python (when using pyls) was identified:
   * rename was failing with an obscure message when the source code could
   * not be parsed correctly by rope (due to a user's syntax error).
   *
   * This function detects such a condition using diagnostics feature
   * and provides a nice error message to the user.
  static ux_workaround_for_rope_limitation(
    error: Error,
    diagnostics_feature: DiagnosticsCM,
    editor: CodeMirrorVirtualEditor,
    rename_feature: RenameFeature
  ): string | null {
    let has_index_error = false;
    try {
      has_index_error = error.message.includes('IndexError');
    } catch (e) {
      return null;
    }
    if (!has_index_error) {
      return null;
    }
    let dire_python_errors = (
      diagnostics_feature.diagnostics_db.all || []
    ).filter(
      diagnostic =>
        diagnostic.diagnostic.message.includes('invalid syntax') ||
        diagnostic.diagnostic.message.includes('SyntaxError') ||
        diagnostic.diagnostic.message.includes('IndentationError')
    );

    if (dire_python_errors.length === 0) {
      return null;
    }

    let dire_errors = [
      ...new Set(
        dire_python_errors.map(diagnostic => {
          let message = diagnostic.diagnostic.message;
          let start = diagnostic.range.start;
          if (rename_feature.adapter.hasMultipleEditors) {
            let { index: editor_id } = editor.find_editor(diagnostic.editor);
            let cell_number = editor_id + 1;
            // TODO: should we show "code cell" numbers, or just cell number?
            return rename_feature._trans.__(
              '%1 in cell %2 at line %3',
              message,
              cell_number,
              start.line
            );
          } else {
            return rename_feature._trans.__(
              '%1 at line %2',
              message,
              start.line
            );
          }
        })
      )
    ].join(', ');
    return rename_feature._trans.__(
      'Syntax error(s) prevents rename: %1',
      dire_errors
    );
  }
   */
}


export namespace RenameFeature {
  export interface IOptions extends Feature.IOptions {
    trans: TranslationBundle
  }
  export const id = FEATURE_ID;
}

namespace CommandIDs {
  export const renameSymbol = 'lsp:rename-symbol';
}

export const RENAME_PLUGIN: JupyterFrontEndPlugin<void> = {
  id: FEATURE_ID,
  requires: [
    ILSPFeatureManager,
    ILSPDocumentConnectionManager,
  ],
  optional: [ICommandPalette, ITranslator],
  // optional: [ILSPDiagnostics], - TODO
  autoStart: true,
  activate: (
    app: JupyterFrontEnd,
    featureManager: ILSPFeatureManager,
    connectionManager: ILSPDocumentConnectionManagerDownstream,
    palette: ICommandPalette,
    //diagnostics: ILSPDiagnostics,
    translator: ITranslator
  ) => {
    const trans = (translator || nullTranslator).load('jupyterlab_lsp');

    const feature = new RenameFeature({
      trans,
      connectionManager
    })
    featureManager.register(feature);

    const assembler = new ContextAssembler({
      app,
      connectionManager
    });

    app.commands.addCommand(CommandIDs.renameSymbol, {
      execute: async () => {
        const context = assembler.getContext();
        if (!context) {
          return;
        }
        const {
          adapter,
          connection,
          virtualPosition,
          rootPosition,
          document
        } = context;

        const editorIndex = adapter.getEditorIndexAt(virtualPosition);
        const editorAccessor = adapter.editors[editorIndex].ceEditor;
        const editor = editorAccessor?.getEditor();
        if (!editor) {
          console.log('[rename] no editor')
          return;
        }
        const offset = editor.getOffsetAt(PositionConverter.cm_to_ce(rootPosition));
        let oldValue = editor.getTokenAt(offset).value;
        let handleFailure = (error: Error) => {
          let status: string | null = '';

          /*
          // TODO
          if (features.has(DIAGNOSTICS_PLUGIN_ID)) {
            let diagnostics_feature = features.get(
              DIAGNOSTICS_PLUGIN_ID
            ) as DiagnosticsCM;

            status = RenameFeature.ux_workaround_for_rope_limitation(
              error,
              diagnostics_feature,
              editor as CodeMirrorVirtualEditor,
              feature
            );
          }
          */

          if (!status) {
            Notification.error(trans.__(`Rename failed: %1`, error));
          } else {
            Notification.info(status);
          }
        };

        const dialogValue = await InputDialog.getText({
          title: trans.__('Rename to'),
          text: oldValue,
          okLabel: trans.__('Rename'),
          cancelLabel: trans.__('Cancel')
        });

        try {
          const newValue = dialogValue.value;
          if (dialogValue.button.accept != true || newValue == null) {
            // the user has cancelled the rename action or did not provide new value
            return;
          }
          Notification.info(
            trans.__('Renaming %1 to %2...', oldValue, newValue)
          );
          const edit = await connection!.clientRequests['textDocument/rename'].request({
            position: {
              line: virtualPosition.line,
              character: virtualPosition.ch
            },
            textDocument: {
              uri: document.documentInfo.uri
            },
            newName: newValue
          });
          if (edit) {
            await feature.handleRename(edit, oldValue, newValue, adapter);
          } else {
            handleFailure(new Error('no edit from server'));
          }
        } catch (error) {
          handleFailure(error);
        }
      },
      isVisible: () => {
        const context = assembler.getContext();
        if (!context) {
          return;
        }
        const { connection } = context;
        return (
          connection != null &&
          connection.isReady &&
          (connection ? connection.provides('renameProvider') : false)
        )
      },
      isEnabled: () => {
        return assembler.isContextMenuOverToken() ? true : false;
      },
      label: trans.__('Rename symbol'),
      icon: renameIcon
    });

    // add to menus
    app.contextMenu.addItem({
      selector: '.jp-Notebook .jp-CodeCell .jp-Editor',
      command: CommandIDs.renameSymbol,
      rank: 10
    });

    app.contextMenu.addItem({
      selector: '.jp-FileEditor',
      command: CommandIDs.renameSymbol,
      rank: 0
    });

    palette.addItem({
      command: CommandIDs.renameSymbol,
      category: trans.__('Language Server Protocol')
    });
  }
};