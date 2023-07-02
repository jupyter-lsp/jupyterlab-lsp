import * as lsProtocol from 'vscode-languageserver-protocol';
import {
  WidgetLSPAdapter,
  IEditorPosition,
  IVirtualPosition,
  ILSPConnection,
  VirtualDocument
} from '@jupyterlab/lsp';
import { linter, Diagnostic } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { BrowserConsole } from '../../virtual/console';
import { PLUGIN_ID } from '../../tokens';
import { FeatureSettings, Feature } from '../../feature';
import { DiagnosticSeverity, DiagnosticTag } from '../../lsp';
import { CodeDiagnostics as LSPDiagnosticsSettings } from '../../_diagnostics';
import { PositionConverter } from '../../converter';
import { uris_equal } from '../../utils';
import { diagnosticsPanel } from './diagnostics';
import { INotebookShell } from '@jupyter-notebook/application';
import { ILabShell } from '@jupyterlab/application';
import { IDocumentWidget } from '@jupyterlab/docregistry';
import { TranslationBundle } from '@jupyterlab/translation';
import {
  CodeMirrorEditor,
  IEditorExtensionRegistry,
  EditorExtensionRegistry
} from '@jupyterlab/codemirror';

export const FEATURE_ID = PLUGIN_ID + ':diagnostics';

import { DiagnosticsDatabase, IEditorDiagnostic } from './listing';

// TODO private of feature?
export const diagnosticsDatabases = new WeakMap<
  WidgetLSPAdapter<any>,
  DiagnosticsDatabase
>();

const SeverityMap: Record<
  1 | 2 | 3 | 4,
  'error' | 'warning' | 'info' | 'hint'
> = {
  1: 'error',
  2: 'warning',
  3: 'info',
  4: 'hint'
};

export class DiagnosticsFeature extends Feature {
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
  protected settings: FeatureSettings<LSPDiagnosticsSettings>;
  protected console = new BrowserConsole().scope('Diagnostics');

  constructor(options: DiagnosticsFeature.IOptions) {
    super(options);
    this.settings = options.settings;

    options.connectionManager.connected.connect((manager, connectionData) => {
      const { connection, virtualDocument } = connectionData;
      const adapter = manager.adapters.get(virtualDocument.path)!;
      // TODO: unregister
      connection.serverNotifications['textDocument/publishDiagnostics'].connect(
        (connection: ILSPConnection, diagnostics) => {
          this.handleDiagnostic(diagnostics, virtualDocument, adapter);
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

    const connectionManager = options.connectionManager;
    // https://github.com/jupyterlab/jupyterlab/issues/14783
    options.shell.currentChanged.connect(shell => {
      if (shell.currentWidget) {
        const x = shell.currentWidget as IDocumentWidget;
        if (x.context) {
          console.log(
            x.context.path,
            connectionManager.adapters.get(x.context.path)
          );
        }
      }
      const adapter = [...connectionManager.adapters.values()].find(
        adapter => adapter.widget == shell.currentWidget
      );

      if (!adapter) {
        this.console.debug('No adapter');
      } else {
        this.switchDiagnosticsPanelSource(adapter);
      }
    });

    options.editorExtensionRegistry.addExtension({
      name: 'lsp:diagnostics',
      factory: options => {
        const source = (view: EditorView) => {
          let diagnostics: Diagnostic[] = [];

          const adapter = [...connectionManager.adapters.values()].find(
            adapter => adapter.widget.node.contains(view.contentDOM) // this is going to be problematic with the windowed notebook. Another solution is needed.
          );
          // const adapter = connectionManager.adapterByModel.get(options.model)!;

          if (!adapter) {
            this.console.debug(
              'No adapter found for editor by model. Maybe not registered yet?'
            );
            return [];
          }
          const database = this.getDiagnosticsDB(adapter);

          for (const [_, editorDiagnostics] of database.entries()) {
            for (const editorDiagnostic of editorDiagnostics) {
              if (editorDiagnostic.editor.editor !== view) {
                continue;
              }
              const diagnostic = editorDiagnostic.diagnostic;
              const severity = SeverityMap[diagnostic.severity!];

              const from = editorDiagnostic.editor.getOffsetAt(
                PositionConverter.cm_to_ce(editorDiagnostic.range.start)
              );
              const to = editorDiagnostic.editor.getOffsetAt(
                PositionConverter.cm_to_ce(editorDiagnostic.range.end)
              );

              //for (const tag of new Set(tags)) {
              //  classNames.push('cm-lsp-diagnostic-tag-' + DiagnosticTag[tag]);
              //}
              //diagnostic.
              diagnostics.push({
                from,
                to,
                // TODO: how to support "hint"?
                severity: severity as any,
                message: diagnostic.message,
                source: diagnostic.source
                // TODO: support tags
                // TODO: actions
              });
            }
          }
          return diagnostics;
        };

        // TODO: adjust config?
        const lspLinter = linter(source, { delay: 500 });

        return EditorExtensionRegistry.createImmutableExtension([lspLinter]);
      }
    });

    //this.connectionManager.adapterRegistered.connect((adapter) =>
    //  this.switchDiagnosticsPanelSource(adapter)
    //);
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
    if (!diagnosticsDatabases.has(adapter)) {
      diagnosticsDatabases.set(adapter, new DiagnosticsDatabase());
    }
    return diagnosticsDatabases.get(adapter)!;
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

  protected collapseOverlappingDiagnostics(
    diagnostics: lsProtocol.Diagnostic[]
  ): Map<lsProtocol.Range, lsProtocol.Diagnostic[]> {
    // because Range is not a primitive type, the equality of the objects having
    // the same parameters won't be compared (thus considered equal) in Map.

    // instead, a intermediate step of mapping through a stringified representation of Range is needed:
    // an alternative would be using nested [start line][start character][end line][end character] structure,
    // which would increase the code complexity, but reduce memory use and may be slightly faster.
    type RangeID = string;
    const range_id_to_range = new Map<RangeID, lsProtocol.Range>();
    const range_id_to_diagnostics = new Map<RangeID, lsProtocol.Diagnostic[]>();

    function get_range_id(range: lsProtocol.Range): RangeID {
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
      let range_id = get_range_id(range);
      range_id_to_range.set(range_id, range);
      if (range_id_to_diagnostics.has(range_id)) {
        let ranges_list = range_id_to_diagnostics.get(range_id)!;
        ranges_list.push(diagnostic);
      } else {
        range_id_to_diagnostics.set(range_id, [diagnostic]);
      }
    });

    let map = new Map<lsProtocol.Range, lsProtocol.Diagnostic[]>();

    range_id_to_diagnostics.forEach(
      (range_diagnostics: lsProtocol.Diagnostic[], range_id: RangeID) => {
        let range = range_id_to_range.get(range_id)!;
        map.set(range, range_diagnostics);
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
    let diagnostics_list: IEditorDiagnostic[] = [];

    // add new markers, keep track of the added ones

    // TODO: test case for severity class always being set, even if diagnostic has no severity

    let diagnostics_by_range = this.collapseOverlappingDiagnostics(
      this.filterDiagnostics(response.diagnostics)
    );

    diagnostics_by_range.forEach(
      (diagnostics: lsProtocol.Diagnostic[], range: lsProtocol.Range) => {
        const start = PositionConverter.lsp_to_cm(
          range.start
        ) as IVirtualPosition;
        const end = PositionConverter.lsp_to_cm(range.end) as IVirtualPosition;
        const last_line_number =
          document.lastVirtualLine - document.blankLinesBetweenCells;
        if (start.line > last_line_number) {
          this.console.log(
            `Out of range diagnostic (${start.line} line > ${last_line_number}) was skipped `,
            diagnostics
          );
          return;
        } else {
          let last_line = document.lastLine;
          if (start.line == last_line_number && start.ch > last_line.length) {
            this.console.log(
              `Out of range diagnostic (${start.ch} character > ${last_line.length} at line ${last_line_number}) was skipped `,
              diagnostics
            );
            return;
          }
        }

        if (
          // @ts-ignore TODO
          document.virtualLines
            .get(start.line)!
            .skipInspect.indexOf(document.idPath) !== -1
        ) {
          this.console.log(
            'Ignoring inspections silenced for this document:',
            diagnostics
          );
          return;
        }

        let editorAccessor = document.getEditorAtVirtualLine(start);
        let editor = editorAccessor.getEditor()!;

        let startInEditor = document.transformVirtualToEditor(start);
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

        let range_in_editor = {
          start: startInEditor,
          end: endInEditor
        };
        for (let diagnostic of diagnostics) {
          diagnostics_list.push({
            diagnostic,
            editor: editor as CodeMirrorEditor,
            range: range_in_editor
          });
        }
      }
    );

    const diagnosticsDB = this.getDiagnosticsDB(adapter);
    diagnosticsDB.set(document, diagnostics_list);
  }

  public handleDiagnostic = (
    response: lsProtocol.PublishDiagnosticsParams,
    document: VirtualDocument,
    adapter: WidgetLSPAdapter<any>
  ) => {
    // use optional chaining operator because the diagnostics message may come late (after the document was disposed)
    if (!uris_equal(response.uri, document?.documentInfo?.uri)) {
      return;
    }

    if (document.lastVirtualLine === 0) {
      return;
    }

    /* TODO: gutters */
    try {
      this._lastResponse = response;
      this._lastDocument = document;
      this._lastAdapter = adapter;
      this.setDiagnostics(response, document, adapter);
      diagnosticsPanel.update();
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

  /**
  protected removeUnusedDiagnosticMarkers(to_retain: Set<string>) {
    const toRemoveByEditor = new Map<
      CodeMirror.Editor,
      { marker: CodeMirror.TextMarker; hash: string }[]
    >();

    for (const [
      diagnosticHash,
      markedDiagnostic
    ] of this.marked_diagnostics.entries()) {
      if (!to_retain.has(diagnosticHash)) {
        let diagnosticsList = toRemoveByEditor.get(markedDiagnostic.editor);
        if (!diagnosticsList) {
          diagnosticsList = [];
          toRemoveByEditor.set(markedDiagnostic.editor, diagnosticsList);
        }
        diagnosticsList.push({
          marker: markedDiagnostic.marker,
          hash: diagnosticHash
        });
      }
    }

    for (const [cmEditor, markers] of toRemoveByEditor.entries()) {
      cmEditor.operation(() => {
        for (const markerData of markers) {
          markerData.marker.clear();
          this.marked_diagnostics.delete(markerData.hash);
        }
      });
    }
  }

  /**
  remove(): void {
    this.settings.changed.disconnect(this.refreshDiagnostics, this);
    // remove all markers
    this.removeUnusedDiagnosticMarkers(new Set());
    this.diagnostics_db.clear();
    diagnosticsDatabases.delete(this.virtual_editor);
    this.unique_editor_ids.clear();

    if (
      diagnosticsPanel.content.model.virtual_editor === this.virtual_editor
    ) {
      diagnosticsPanel.content.model.virtual_editor = null;
      diagnosticsPanel.content.model.diagnostics = null;
      diagnosticsPanel.content.model.adapter = null;
    }

    diagnosticsPanel.update();
  }
  */

  private _lastResponse: lsProtocol.PublishDiagnosticsParams;
  private _lastDocument: VirtualDocument;
  private _lastAdapter: WidgetLSPAdapter<any>;
  private _trans: TranslationBundle;
}

export namespace DiagnosticsFeature {
  export interface IOptions extends Feature.IOptions {
    settings: FeatureSettings<LSPDiagnosticsSettings>;
    shell: ILabShell | INotebookShell;
    trans: TranslationBundle;
    editorExtensionRegistry: IEditorExtensionRegistry;
  }
  export const id = PLUGIN_ID + ':diagnostics';
}
