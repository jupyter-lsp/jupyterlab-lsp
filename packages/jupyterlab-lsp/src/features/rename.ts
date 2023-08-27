import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  InputDialog,
  Notification,
  ICommandPalette
} from '@jupyterlab/apputils';
import {
  ILSPFeatureManager,
  ILSPDocumentConnectionManager,
  WidgetLSPAdapter
} from '@jupyterlab/lsp';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import {
  ITranslator,
  nullTranslator,
  TranslationBundle
} from '@jupyterlab/translation';
import { LabIcon } from '@jupyterlab/ui-components';
import * as lsProtocol from 'vscode-languageserver-protocol';

import renameSvg from '../../style/icons/rename.svg';
import { CodeRename as LSPRenameSettings } from '../_rename';
import { ContextAssembler } from '../context';
import {
  PositionConverter,
  editorAtRootPosition,
  rootPositionToEditorPosition
} from '../converter';
import { EditApplicator, IEditOutcome } from '../edits';
import { FeatureSettings, Feature } from '../feature';
import { PLUGIN_ID } from '../tokens';
import { BrowserConsole } from '../virtual/console';
import { VirtualDocument } from '../virtual/document';

import { IDiagnosticsFeature } from './diagnostics/tokens';

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
  };
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
    adapter: WidgetLSPAdapter<any>,
    document: VirtualDocument
  ) {
    let outcome: IEditOutcome;
    const applicator = new EditApplicator(document, adapter);

    try {
      outcome = await applicator.applyEdit(workspaceEdit);
    } catch (error) {
      Notification.emit(this._trans.__('Rename failed: %1', error), 'error');
      return;
    }

    try {
      let status: string;
      const changeText = this._trans.__('%1 to %2', oldValue, newValue);
      let severity: 'success' | 'warning' | 'error' = 'success';

      if (outcome.appliedChanges === 0) {
        status = this._trans.__(
          'Could not rename %1 - consult the language server documentation',
          changeText
        );
        severity = 'warning';
      } else if (outcome.wasGranular) {
        status = this._trans._n(
          'Renamed %2 in %3 place',
          'Renamed %2 in %3 places',
          outcome.appliedChanges!,
          changeText,
          outcome.appliedChanges
        );
      } else if (adapter.hasMultipleEditors) {
        status = this._trans._n(
          'Renamed %2 in %3 cell',
          'Renamed %2 in %3 cells',
          outcome.modifiedCells,
          changeText,
          outcome.modifiedCells
        );
      } else {
        status = this._trans.__('Renamed %1', changeText);
      }

      if (outcome.errors.length !== 0) {
        status += this._trans.__(' with errors: %1', outcome.errors);
        severity = 'error';
      }

      Notification.emit(status, severity, {
        autoClose: (severity === 'error' ? 5 : 3) * 1000
      });
    } catch (error) {
      this.console.warn(error);
    }

    return outcome;
  }
}

/**
 * In #115 an issue with rename for Python (when using pyls) was identified:
 * rename was failing with an obscure message when the source code could
 * not be parsed correctly by rope (due to a user's syntax error).
 *
 * This function detects such a condition using diagnostics feature
 * and provides a nice error message to the user.
 */
function guessFailureReason(
  error: Error,
  adapter: WidgetLSPAdapter<any>,
  diagnostics: IDiagnosticsFeature,
  trans: TranslationBundle
): string | null {
  let hasIndexError = false;
  try {
    hasIndexError = error.message.includes('IndexError');
  } catch (e) {
    return null;
  }
  if (!hasIndexError) {
    return null;
  }
  let direPythonErrors = (
    diagnostics.getDiagnosticsDB(adapter).all || []
  ).filter(
    diagnostic =>
      diagnostic.diagnostic.message.includes('invalid syntax') ||
      diagnostic.diagnostic.message.includes('SyntaxError') ||
      diagnostic.diagnostic.message.includes('IndentationError')
  );

  if (direPythonErrors.length === 0) {
    return null;
  }

  let direErrors = [
    ...new Set(
      direPythonErrors.map(diagnostic => {
        let message = diagnostic.diagnostic.message;
        let start = diagnostic.range.start;
        if (adapter.hasMultipleEditors) {
          let editorIndex = adapter.editors.findIndex(
            e => e.ceEditor.getEditor() === diagnostic.editor
          );
          let cellNumber = editorIndex === -1 ? '(?)' : editorIndex + 1;
          return trans.__(
            '%1 in cell %2 at line %3',
            message,
            cellNumber,
            start.line
          );
        } else {
          return trans.__('%1 at line %2', message, start.line);
        }
      })
    )
  ].join(', ');
  return trans.__('Syntax error(s) prevents rename: %1', direErrors);
}

export namespace RenameFeature {
  export interface IOptions extends Feature.IOptions {
    trans: TranslationBundle;
  }
  export const id = FEATURE_ID;
}

export namespace CommandIDs {
  export const renameSymbol = 'lsp:rename-symbol';
}

export const RENAME_PLUGIN: JupyterFrontEndPlugin<void> = {
  id: FEATURE_ID,
  requires: [
    ILSPFeatureManager,
    ISettingRegistry,
    ILSPDocumentConnectionManager
  ],
  optional: [ICommandPalette, IDiagnosticsFeature, ITranslator],
  autoStart: true,
  activate: async (
    app: JupyterFrontEnd,
    featureManager: ILSPFeatureManager,
    settingRegistry: ISettingRegistry,
    connectionManager: ILSPDocumentConnectionManager,
    palette: ICommandPalette,
    diagnostics: IDiagnosticsFeature,
    translator: ITranslator
  ) => {
    const trans = (translator || nullTranslator).load('jupyterlab_lsp');
    const settings = new FeatureSettings<LSPRenameSettings>(
      settingRegistry,
      RenameFeature.id
    );
    await settings.ready;

    if (settings.composite.disable) {
      return;
    }
    const feature = new RenameFeature({
      trans,
      connectionManager
    });
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
        const { adapter, connection, virtualPosition, rootPosition, document } =
          context;

        const editorAccessor = editorAtRootPosition(adapter, rootPosition);
        const editor = editorAccessor?.getEditor();
        if (!editor) {
          console.log('Could not rename - no editor');
          return;
        }
        const editorPosition = rootPositionToEditorPosition(
          adapter,
          rootPosition
        );
        const offset = editor.getOffsetAt(
          PositionConverter.cm_to_ce(editorPosition)
        );
        let oldValue = editor.getTokenAt(offset).value;
        let handleFailure = (error: Error) => {
          let status: string | null = '';

          if (diagnostics) {
            status = guessFailureReason(error, adapter, diagnostics, trans);
          }

          if (!status) {
            Notification.error(trans.__(`Rename failed: %1`, error), {
              autoClose: 5 * 1000
            });
          } else {
            Notification.warning(status, { autoClose: 3 * 1000 });
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
            trans.__('Renaming %1 to %2…', oldValue, newValue),
            { autoClose: 3 * 1000 }
          );
          const edit = await connection!.clientRequests[
            'textDocument/rename'
          ].request({
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
            await feature.handleRename(
              edit,
              oldValue,
              newValue,
              adapter,
              document
            );
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
          return false;
        }
        const { connection } = context;
        return (
          connection != null &&
          connection.isReady &&
          connection.provides('renameProvider')
        );
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
