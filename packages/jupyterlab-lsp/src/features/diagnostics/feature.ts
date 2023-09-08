import { linter, Diagnostic, lintGutter } from '@codemirror/lint';
import { StateField, StateEffect, StateEffectType } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { INotebookShell } from '@jupyter-notebook/application';
import { ILabShell } from '@jupyterlab/application';
import { IThemeManager } from '@jupyterlab/apputils';
import {
  CodeMirrorEditor,
  IEditorExtensionRegistry,
  EditorExtensionRegistry
} from '@jupyterlab/codemirror';
import {
  WidgetLSPAdapter,
  IEditorPosition,
  IVirtualPosition,
  ILSPConnection,
  VirtualDocument
} from '@jupyterlab/lsp';
import { TranslationBundle } from '@jupyterlab/translation';
import { PromiseDelegate } from '@lumino/coreutils';
import * as lsProtocol from 'vscode-languageserver-protocol';

import { CodeDiagnostics as LSPDiagnosticsSettings } from '../../_diagnostics';
import { PositionConverter } from '../../converter';
import { IFeatureSettings, Feature } from '../../feature';
import { DiagnosticSeverity, DiagnosticTag } from '../../lsp';
import { PLUGIN_ID } from '../../tokens';
import { urisEqual } from '../../utils';
import { BrowserConsole } from '../../virtual/console';

import { diagnosticsPanel } from './diagnostics';
import { DiagnosticsDatabase } from './listing';
import { IDiagnosticsFeature, IEditorDiagnostic } from './tokens';
import { underline } from './underline';

const SeverityMap: Record<
  1 | 2 | 3 | 4,
  'error' | 'warning' | 'info' | 'hint'
> = {
  1: 'error',
  2: 'warning',
  3: 'info',
  4: 'hint'
};

export class DiagnosticsFeature extends Feature implements IDiagnosticsFeature {
  readonly id = DiagnosticsFeature.id;
  readonly capabilities: lsProtocol.ClientCapabilities = {
    textDocument: {
      publishDiagnostics: {
        tagSupport: {
          valueSet: [DiagnosticTag.Deprecated, DiagnosticTag.Unnecessary]
        }
      }
    }
  };
  protected settings: IFeatureSettings<LSPDiagnosticsSettings>;
  protected console = new BrowserConsole().scope('Diagnostics');
  private _firstResponseReceived: PromiseDelegate<void> = new PromiseDelegate();
  private _diagnosticsDatabases = new WeakMap<
    WidgetLSPAdapter<any>,
    DiagnosticsDatabase
  >();

  constructor(options: DiagnosticsFeature.IOptions) {
    super(options);
    this.settings = options.settings;

    options.connectionManager.connected.connect((manager, connectionData) => {
      const { connection, virtualDocument } = connectionData;
      const adapter = manager.adapters.get(virtualDocument.root.path)!;
      // TODO: unregister
      connection.serverNotifications['textDocument/publishDiagnostics'].connect(
        async (connection: ILSPConnection, diagnostics) => {
          await this.handleDiagnostic(diagnostics, virtualDocument, adapter);
        }
      );
      virtualDocument.foreignDocumentClosed.connect((document, context) => {
        // TODO: check if we need to cast
        this.clearDocumentDiagnostics(adapter, context.foreignDocument);
      });
    });

    //this.unique_editor_ids = new DefaultMap(() => this.unique_editor_ids.size);
    this.settings.changed.connect(this.refreshDiagnostics, this);
    this._trans = options.trans;
    this._invalidate = StateEffect.define<void>();
    this._invalidationCounter = StateField.define<number>({
      create: () => 0,
      update: (value, tr) => {
        for (const e of tr.effects) {
          if (e.is(this._invalidate)) {
            value += 1;
          }
        }
        return value;
      }
    });

    const connectionManager = options.connectionManager;
    // https://github.com/jupyterlab/jupyterlab/issues/14783
    options.shell.currentChanged.connect(shell => {
      const adapter = [...connectionManager.adapters.values()].find(
        adapter => adapter.widget == shell.currentWidget
      );

      if (!adapter) {
        this.console.debug('No adapter');
      } else {
        this.switchDiagnosticsPanelSource(adapter);
      }
    });

    const settings = options.settings;
    const themeManager = options.themeManager;

    this._reconfigureTheme();
    document.head.appendChild(this._styleElement);

    if (themeManager) {
      themeManager.themeChanged.connect(() => {
        this._reconfigureTheme();
      });
    }

    options.editorExtensionRegistry.addExtension({
      name: 'lsp:diagnostics',
      factory: options => {
        const source = async (view: EditorView) => {
          let diagnostics: Diagnostic[] = [];

          const adapter = [...connectionManager.adapters.values()].find(
            adapter => adapter.widget.node.contains(view.contentDOM) // this is going to be problematic with the windowed notebook. Another solution is needed.
          );

          if (!adapter) {
            this.console.debug(
              'No adapter found for editor by model. Maybe not registered yet?'
            );
            return [];
          }
          // NHT: `response.version` could be checked against document versions
          // and if non matches we could yield (raise an error or hang for a
          // few seconds to trigger timeout). Because `response.version` is
          // optional it would require further testing.

          if (view.state.field(this._invalidationCounter) == 0) {
            // If we are displaying the editor for the first time,
            // e.g. after scrolling down in windowed notebook,
            // do not wait for next update, show what we already know.

            // TODO: this still fails when scrolling down fast and then
            // scrolling up to the skipped cells because the state invalidation
            // counter kicks in but diagnostics does not get rendered yet before
            // we leave..
            await this._firstResponseReceived.promise;
          } else {
            await adapter.updateFinished;
          }

          const database = this.getDiagnosticsDB(adapter);

          for (const editorDiagnostics of database.values()) {
            for (const editorDiagnostic of editorDiagnostics) {
              const editor = editorDiagnostic.editorAccessor.getEditor() as
                | CodeMirrorEditor
                | undefined;

              if (editor?.editor !== view) {
                continue;
              }
              const diagnostic = editorDiagnostic.diagnostic;
              const severity = SeverityMap[diagnostic.severity!];

              const lines = view.state.doc.lines;
              const lastLineLength = view.state.doc.line(lines).length;
              const start = PositionConverter.cm_to_ce(
                editorDiagnostic.range.start
              );
              const end = PositionConverter.cm_to_ce(
                editorDiagnostic.range.end
              );

              const from = editor.getOffsetAt(
                start.line >= lines
                  ? {
                      line: Math.min(start.line, lines),
                      column: Math.min(start.column, lastLineLength)
                    }
                  : start
              );
              // TODO: this is wrong; there is however an issue if this is not applied
              const to = editor.getOffsetAt(
                end.line >= lines
                  ? {
                      line: Math.min(end.line, lines),
                      column: Math.min(end.column, lastLineLength)
                    }
                  : end
              );

              const classNames = [];
              for (const tag of new Set(diagnostic.tags)) {
                classNames.push('cm-lsp-diagnostic-tag-' + DiagnosticTag[tag]);
              }

              diagnostics.push({
                from: Math.min(from, view.state.doc.length),
                to: Math.min(to, view.state.doc.length),
                severity: severity,
                message: diagnostic.message,
                source: diagnostic.source,
                markClass: classNames.join(' ')
                // TODO: actions
              });
            }
          }
          return diagnostics;
        };

        // never run linter on typing - we will trigger it manually when update is needed
        const lspLinter = linter(source, {
          delay: settings.composite.debounceDelay || 250,
          needsRefresh: update => {
            const previous = update.startState.field(this._invalidationCounter);
            const current = update.state.field(this._invalidationCounter);
            return previous !== current;
          }
        });

        const extensions = [lspLinter, this._invalidationCounter];
        if (settings.composite.gutter) {
          extensions.push(lintGutter());
        }

        return EditorExtensionRegistry.createImmutableExtension(extensions);
      }
    });
  }

  private _reconfigureTheme() {
    const style = getComputedStyle(document.body);
    const baseTheme = EditorView.baseTheme({
      '.cm-lintRange-error': {
        backgroundImage: underline(
          style.getPropertyValue(
            '--jp-editor-mirror-lsp-diagnostic-error-decoration-color'
          )
        )
      },
      '.cm-lintRange-warning': {
        backgroundImage: underline(
          style.getPropertyValue(
            '--jp-editor-mirror-lsp-diagnostic-warning-decoration-color'
          )
        )
      },
      '.cm-lintRange-info': {
        backgroundImage: underline(
          style.getPropertyValue(
            '--jp-editor-mirror-lsp-diagnostic-information-decoration-color'
          )
        )
      },
      '.cm-lintRange-hint': {
        backgroundImage: underline(
          style.getPropertyValue(
            '--jp-editor-mirror-lsp-diagnostic-hint-decoration-color'
          )
        )
      }
    });
    const tempEditor = new EditorView({ extensions: baseTheme });
    const styleModules = tempEditor.state.facet(EditorView.styleModule);
    const ourRules = styleModules.find(styleModule => {
      const rules = styleModule.getRules().split('\n');
      return rules.every(rule => rule.includes('cm-lintRange'));
    })!;
    this._styleElement.innerHTML = ourRules.getRules();
  }

  clearDocumentDiagnostics(
    adapter: WidgetLSPAdapter<any>,
    document: VirtualDocument
  ) {
    this.getDiagnosticsDB(adapter).set(document, []);
  }

  /**
   * Allows access to the most recent diagnostics in context of the editor.
   *
   * One can use VirtualEditorForNotebook.find_cell_by_editor() to find
   * the corresponding cell in notebook.
   * Can be used to implement a Panel showing diagnostics list.
   *
   * Maps virtualDocument.uri to IEditorDiagnostic[].
   */
  public getDiagnosticsDB(adapter: WidgetLSPAdapter<any>): DiagnosticsDatabase {
    // Note that virtual_editor can change at runtime (kernel restart)
    if (!this._diagnosticsDatabases.has(adapter)) {
      this._diagnosticsDatabases.set(adapter, new DiagnosticsDatabase());
    }
    return this._diagnosticsDatabases.get(adapter)!;
  }

  switchDiagnosticsPanelSource = (adapter: WidgetLSPAdapter<any>) => {
    diagnosticsPanel.trans = this._trans;
    const diagnostics = this.getDiagnosticsDB(adapter);
    if (diagnosticsPanel.content.model.diagnostics == diagnostics) {
      return;
    }
    diagnosticsPanel.content.model.diagnostics = diagnostics;
    diagnosticsPanel.content.model.adapter = adapter;
    diagnosticsPanel.content.model.settings = this.settings;
    diagnosticsPanel.feature = this;
    diagnosticsPanel.update();
  };

  protected diagnosticsByRange(
    diagnostics: lsProtocol.Diagnostic[]
  ): Map<lsProtocol.Range, lsProtocol.Diagnostic[]> {
    // because Range is not a primitive type, the equality of the objects having
    // the same parameters won't be compared (thus considered equal) in Map.

    // instead, a intermediate step of mapping through a stringified representation of Range is needed:
    // an alternative would be using nested [start line][start character][end line][end character] structure,
    // which would increase the code complexity, but reduce memory use and may be slightly faster.
    type RangeID = string;
    const rangeIdToRange = new Map<RangeID, lsProtocol.Range>();
    const rangeIdToDiagnostics = new Map<RangeID, lsProtocol.Diagnostic[]>();

    function getRangeId(range: lsProtocol.Range): RangeID {
      return (
        range.start.line +
        ',' +
        range.start.character +
        ',' +
        range.end.line +
        ',' +
        range.end.character
      );
    }

    diagnostics.forEach((diagnostic: lsProtocol.Diagnostic) => {
      let range = diagnostic.range;
      let rangeId = getRangeId(range);
      rangeIdToRange.set(rangeId, range);
      if (rangeIdToDiagnostics.has(rangeId)) {
        let rangesList = rangeIdToDiagnostics.get(rangeId)!;
        rangesList.push(diagnostic);
      } else {
        rangeIdToDiagnostics.set(rangeId, [diagnostic]);
      }
    });

    let map = new Map<lsProtocol.Range, lsProtocol.Diagnostic[]>();

    rangeIdToDiagnostics.forEach(
      (rangeDiagnostics: lsProtocol.Diagnostic[], rangeId: RangeID) => {
        let range = rangeIdToRange.get(rangeId)!;
        map.set(range, rangeDiagnostics);
      }
    );

    return map;
  }

  get defaultSeverity(): lsProtocol.DiagnosticSeverity {
    return DiagnosticSeverity[this.settings.composite.defaultSeverity];
  }

  private filterDiagnostics(
    diagnostics: lsProtocol.Diagnostic[]
  ): lsProtocol.Diagnostic[] {
    const ignoredDiagnosticsCodes = new Set(
      this.settings.composite.ignoreCodes
    );
    const ignoredSeverities = new Set<number>(
      this.settings.composite.ignoreSeverities.map(
        severityName => DiagnosticSeverity[severityName]
      )
    );
    const ignoredMessagesRegExp =
      this.settings.composite.ignoreMessagesPatterns.map(
        pattern => new RegExp(pattern)
      );

    return diagnostics.filter(diagnostic => {
      let code = diagnostic.code;
      if (
        typeof code !== 'undefined' &&
        // pygls servers return code null if value is missing (rather than undefined)
        // which is a departure from the LSP specs: https://microsoft.github.io/language-server-protocol/specification#diagnostic
        // there is an open issue: https://github.com/openlawlibrary/pygls/issues/124
        // and PR: https://github.com/openlawlibrary/pygls/pull/132
        // this also affects hover tooltips.
        code !== null &&
        ignoredDiagnosticsCodes.has(code.toString())
      ) {
        return false;
      }
      let severity = diagnostic.severity;
      if (severity && ignoredSeverities.has(severity)) {
        return false;
      }
      let message = diagnostic.message;
      if (
        message &&
        ignoredMessagesRegExp.some(pattern => pattern.test(message))
      ) {
        return false;
      }
      return true;
    });
  }

  setDiagnostics(
    response: lsProtocol.PublishDiagnosticsParams,
    document: VirtualDocument,
    adapter: WidgetLSPAdapter<any>
  ) {
    let diagnosticsList: IEditorDiagnostic[] = [];
    // TODO: test case for severity class always being set, even if diagnostic has no severity

    let diagnosticsByRange = this.diagnosticsByRange(
      this.filterDiagnostics(response.diagnostics)
    );

    diagnosticsByRange.forEach(
      (diagnostics: lsProtocol.Diagnostic[], range: lsProtocol.Range) => {
        const start = PositionConverter.lsp_to_cm(
          range.start
        ) as IVirtualPosition;
        const end = PositionConverter.lsp_to_cm(range.end) as IVirtualPosition;
        const lastLineNumber =
          document.lastVirtualLine - document.blankLinesBetweenCells;
        if (start.line > lastLineNumber) {
          this.console.log(
            `Out of range diagnostic (${start.line} line > ${lastLineNumber}) was skipped `,
            diagnostics
          );
          return;
        } else {
          let lastLine = document.lastLine;
          if (start.line == lastLineNumber && start.ch > lastLine.length) {
            this.console.log(
              `Out of range diagnostic (${start.ch} character > ${lastLine.length} at line ${lastLineNumber}) was skipped `,
              diagnostics
            );
            return;
          }
        }
        if (
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore TODO
          document.virtualLines
            .get(start.line)!
            .skipInspect.includes(document.idPath)
        ) {
          this.console.log(
            'Ignoring inspections silenced for this document:',
            diagnostics,
            document.idPath,
            start.line
          );
          return;
        }

        const editorAccessor = document.getEditorAtVirtualLine(start);

        const startInEditor = document.transformVirtualToEditor(start);
        let endInEditor: IEditorPosition | null;

        if (startInEditor === null) {
          this.console.warn(
            'Start in editor could not be be determined for',
            diagnostics
          );
          return;
        }

        // some servers return strange positions for ends
        try {
          endInEditor = document.transformVirtualToEditor(end);
        } catch (err) {
          this.console.warn('Malformed range for diagnostic', end);
          endInEditor = { ...startInEditor, ch: startInEditor.ch + 1 };
        }

        if (endInEditor === null) {
          this.console.warn(
            'End in editor could not be be determined for',
            diagnostics
          );
          return;
        }

        for (let diagnostic of diagnostics) {
          diagnosticsList.push({
            diagnostic,
            editorAccessor: editorAccessor,
            range: {
              start: startInEditor,
              end: endInEditor
            }
          });
        }
      }
    );

    const diagnosticsDB = this.getDiagnosticsDB(adapter);

    const previousList = diagnosticsDB.get(document);
    const editorsWhichHadDiagnostics = new Set(
      previousList?.map(d => d.editorAccessor.getEditor())
    );

    const editorsWithDiagnostics = new Set(
      diagnosticsList?.map(d => d.editorAccessor.getEditor())
    );
    diagnosticsDB.set(document, diagnosticsList);

    // Refresh editors with diagnostics; this is needed because linter's
    // `source()` method will only refresh the cell with changes, but a change
    // in one cell can influence validity of code in all other cells (e.g. due
    // to removal of variable definition or usage).
    for (const block of adapter.editors) {
      const editor = block.ceEditor.getEditor() as CodeMirrorEditor | undefined;
      if (!editor) {
        continue;
      }
      if (
        !(
          editorsWithDiagnostics.has(editor) ||
          editorsWhichHadDiagnostics.has(editor)
        )
      ) {
        continue;
      }

      editor.editor.dispatch({
        effects: this._invalidate.of()
      });
    }
  }

  public handleDiagnostic = async (
    response: lsProtocol.PublishDiagnosticsParams,
    document: VirtualDocument,
    adapter: WidgetLSPAdapter<any>
  ) => {
    // use optional chaining operator because the diagnostics message may come late (after the document was disposed)
    if (!urisEqual(response.uri, document?.documentInfo?.uri)) {
      return;
    }

    if (document.lastVirtualLine === 0) {
      return;
    }

    try {
      this._lastResponse = response;
      this._lastDocument = document;
      this._lastAdapter = adapter;
      this.setDiagnostics(response, document, adapter);
      const done = new Promise<void>(resolve => {
        setTimeout(() => {
          this._firstResponseReceived.resolve();
          resolve();
        }, 0);
      });
      diagnosticsPanel.update();
      return done;
    } catch (e) {
      this.console.warn(e);
    }
  };

  public refreshDiagnostics() {
    if (this._lastResponse) {
      this.setDiagnostics(
        this._lastResponse,
        this._lastDocument,
        this._lastAdapter
      );
    }
    diagnosticsPanel.update();
  }

  private _lastResponse: lsProtocol.PublishDiagnosticsParams;
  private _lastDocument: VirtualDocument;
  private _lastAdapter: WidgetLSPAdapter<any>;
  private _trans: TranslationBundle;
  private _invalidate: StateEffectType<void>;
  private _invalidationCounter: StateField<number>;
  private _styleElement: HTMLStyleElement = document.createElement('style');
}

export namespace DiagnosticsFeature {
  export interface IOptions extends Feature.IOptions {
    settings: IFeatureSettings<LSPDiagnosticsSettings>;
    shell: ILabShell | INotebookShell;
    trans: TranslationBundle;
    editorExtensionRegistry: IEditorExtensionRegistry;
    themeManager: IThemeManager | null;
  }
  export const id = PLUGIN_ID + ':diagnostics';
}
