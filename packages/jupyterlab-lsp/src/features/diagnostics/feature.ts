import { ISettingRegistry } from '@jupyterlab/settingregistry';
import * as lsProtocol from 'vscode-languageserver-protocol';
import { WidgetLSPAdapter, IEditorPosition, IVirtualPosition, ILSPConnection, VirtualDocument } from '@jupyterlab/lsp';

import { BrowserConsole } from '../../virtual/console';
import { PLUGIN_ID } from '../../tokens';
import { FeatureSettings, Feature } from '../../feature';
import { DiagnosticSeverity, DiagnosticTag } from '../../lsp';
import { CodeDiagnostics as LSPDiagnosticsSettings } from '../../_diagnostics';
//import { LSPConnection } from '../../connection';
import { PositionConverter } from '../../converter';
import { DefaultMap, uris_equal } from '../../utils';
//import { VirtualDocument } from '../../virtual/document';
import { diagnosticsPanel } from './diagnostics';

export const FEATURE_ID = PLUGIN_ID + ':diagnostics';


import {
  DiagnosticsDatabase,
  IEditorDiagnostic
} from './listing';


interface IMarkerDefinition {
  options: CodeMirror.TextMarkerOptions;
  start: IEditorPosition;
  end: IEditorPosition;
  hash: string;
}

interface IMarkedDiagnostic {
  editor: CodeMirror.Editor;
  marker: CodeMirror.TextMarker;
}

// TODO private of feature?
export const diagnostics_databases = new WeakMap<
  WidgetLSPAdapter<any>,
  DiagnosticsDatabase
>();


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
  }
  protected settings: FeatureSettings<LSPDiagnosticsSettings>;
  protected console = new BrowserConsole().scope('Diagnostics');

  constructor(options: DiagnosticsFeature.IOptions) {
    super(options);
    this.settings = new FeatureSettings(options.settingRegistry, this.id);

    options.connectionManager.connected.connect((manager, connectionData) => {

      const { connection, virtualDocument } = connectionData;
      // TODO: unregister
      connection.serverNotifications[
        'textDocument/publishDiagnostics'
      ].connect((connection: ILSPConnection, diagnostics) => {
        this.handleDiagnostic(diagnostics, virtualDocument);
      });
      virtualDocument.foreignDocumentClosed.connect(
      (document, context) => {
        // TODO: check if we need to cast
        this.clearDocumentDiagnostics(context.foreignDocument);
      }
    );
    });
    this.unique_editor_ids = new DefaultMap(() => this.unique_editor_ids.size);
    this.settings.changed.connect(this.refreshDiagnostics, this);
    //const trans = translator.load('jupyterlab_lsp');

    // TODO below
    this.wrapper_handlers.set('focusin', this.switchDiagnosticsPanelSource);
    this.adapter.adapterConnected.connect(() =>
      this.switchDiagnosticsPanelSource()
    );
  }

  clearDocumentDiagnostics(document: VirtualDocument) {
    this.diagnostics_db.set(document, []);
  }

  private unique_editor_ids: DefaultMap<CodeMirror.Editor, number>;
  private marked_diagnostics: Map<string, IMarkedDiagnostic> = new Map();
  /**
   * Allows access to the most recent diagnostics in context of the editor.
   *
   * One can use VirtualEditorForNotebook.find_cell_by_editor() to find
   * the corresponding cell in notebook.
   * Can be used to implement a Panel showing diagnostics list.
   *
   * Maps virtualDocument.uri to IEditorDiagnostic[].
   */
  public get diagnostics_db(): DiagnosticsDatabase {
    // Note that virtual_editor can change at runtime (kernel restart)
    if (!diagnostics_databases.has(this.virtual_editor)) {
      diagnostics_databases.set(this.virtual_editor, new DiagnosticsDatabase());
    }
    return diagnostics_databases.get(this.virtual_editor)!;
  }

  switchDiagnosticsPanelSource = () => {
    diagnosticsPanel.trans = this.adapter.trans;
    if (
      diagnosticsPanel.content.model.virtual_editor === this.virtual_editor &&
      diagnosticsPanel.content.model.diagnostics == this.diagnostics_db
    ) {
      return;
    }
    diagnosticsPanel.content.model.diagnostics = this.diagnostics_db;
    diagnosticsPanel.content.model.adapter = this.adapter;
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

  setDiagnostics(response: lsProtocol.PublishDiagnosticsParams, document: VirtualDocument) {
    let diagnostics_list: IEditorDiagnostic[] = [];

    // Note: no deep equal for Sets or Maps in JS
    const markers_to_retain: Set<string> = new Set();

    // add new markers, keep track of the added ones

    // TODO: test case for severity class always being set, even if diagnostic has no severity

    let diagnostics_by_range = this.collapseOverlappingDiagnostics(
      this.filterDiagnostics(response.diagnostics)
    );

    const markerOptionsByEditor = new Map<
      CodeMirror.Editor,
      IMarkerDefinition[]
    >();

    diagnostics_by_range.forEach(
      (diagnostics: lsProtocol.Diagnostic[], range: lsProtocol.Range) => {
        const start = PositionConverter.lsp_to_cm(
          range.start
        ) as IVirtualPosition;
        const end = PositionConverter.lsp_to_cm(range.end) as IVirtualPosition;
        const last_line_number =
          document.lastVirtualLine -
          document.blankLinesBetweenCells;
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

        /*
        let document: VirtualDocument;
        try {
          // assuming that we got a response for this document
          let start_in_root =
            this.transform_virtual_position_to_root_position(start);
          document =
            this.virtual_editor.document_at_root_position(start_in_root);
        } catch (e) {
          this.console.warn(
            `Could not place inspections from ${response.uri}`,
            ` inspections: `,
            diagnostics,
            'error: ',
            e
          );
          return;
        }

        // This may happen if the response came delayed
        // and the user already changed the document so
        // that now this regions is in another virtual document!
        if (this.virtualDocument !== document) {
          this.console.log(
            `Ignoring inspections from ${response.uri}`,
            ` (this region is covered by a another virtual document: ${document.uri})`,
            ` inspections: `,
            diagnostics
          );
          return;
        }
        */

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

        let ceEditor = document.getEditorAtVirtualLine(start);
        let cm_editor =
          this.virtual_editor.ceEditor_to_cm_editor.get(ceEditor)!;

        let start_in_editor = document.transformVirtualToEditor(start);
        let end_in_editor: IEditorPosition | null;

        if (start_in_editor === null) {
          this.console.warn(
            'Start in editor could not be be determined for',
            diagnostics
          );
          return;
        }

        // some servers return strange positions for ends
        try {
          end_in_editor = document.transformVirtualToEditor(end);
        } catch (err) {
          this.console.warn('Malformed range for diagnostic', end);
          end_in_editor = { ...start_in_editor, ch: start_in_editor.ch + 1 };
        }

        if (end_in_editor === null) {
          this.console.warn(
            'End in editor could not be be determined for',
            diagnostics
          );
          return;
        }

        let range_in_editor = {
          start: start_in_editor,
          end: end_in_editor
        };
        // what a pity there is no hash in the standard library...
        // we could use this: https://stackoverflow.com/a/7616484 though it may not be worth it:
        //   the stringified diagnostic objects are only about 100-200 JS characters anyway,
        //   depending on the message length; this could be reduced using some structure-aware
        //   stringifier; such a stringifier could also prevent the possibility of having a false
        //   negative due to a different ordering of keys
        // obviously, the hash would prevent recovery of info from the key.
        let diagnostic_hash = JSON.stringify({
          // diagnostics without ranges
          diagnostics: diagnostics.map(diagnostic => [
            diagnostic.severity,
            diagnostic.message,
            diagnostic.code,
            diagnostic.source,
            diagnostic.relatedInformation
          ]),
          // the apparent marker position will change in the notebook with every line change for each marker
          // after the (inserted/removed) line - but such markers should not be invalidated,
          // i.e. the invalidation should be performed in the cell space, not in the notebook coordinate space,
          // thus we transform the coordinates and keep the cell id in the hash
          range: range_in_editor,
          editor: this.unique_editor_ids.get(cm_editor)
        });
        for (let diagnostic of diagnostics) {
          diagnostics_list.push({
            diagnostic,
            editor: cm_editor,
            range: range_in_editor
          });
        }

        markers_to_retain.add(diagnostic_hash);

        if (!this.marked_diagnostics.has(diagnostic_hash)) {
          const highestSeverityCode = diagnostics
            .map(diagnostic => diagnostic.severity || this.defaultSeverity)
            .sort()[0];

          const severity = DiagnosticSeverity[highestSeverityCode];

          const classNames = [
            'cm-lsp-diagnostic',
            'cm-lsp-diagnostic-' + severity
          ];

          const tags: lsProtocol.DiagnosticTag[] = [];
          for (let diagnostic of diagnostics) {
            if (diagnostic.tags) {
              tags.push(...diagnostic.tags);
            }
          }
          for (const tag of new Set(tags)) {
            classNames.push('cm-lsp-diagnostic-tag-' + DiagnosticTag[tag]);
          }
          let options: CodeMirror.TextMarkerOptions = {
            title: diagnostics
              .map(d => d.message + (d.source ? ' (' + d.source + ')' : ''))
              .join('\n'),
            className: classNames.join(' ')
          };

          let optionsList = markerOptionsByEditor.get(cm_editor);
          if (!optionsList) {
            optionsList = [];
            markerOptionsByEditor.set(cm_editor, optionsList);
          }
          optionsList.push({
            options,
            start: start_in_editor,
            end: end_in_editor,
            hash: diagnostic_hash
          });
        }
      }
    );

    for (const [
      cmEditor,
      markerDefinitions
    ] of markerOptionsByEditor.entries()) {
      // note: could possibly be wrapped in `requestAnimationFrame()`
      // at a risk of sometimes having an inconsistent state in database.
      // note: using `operation()` significantly improves performance.
      // test cases:
      //   - one cell with 1000 `math.pi` and `import math`; comment out import,
      //     wait for 1000 diagnostics, then uncomment import, wait for removal:
      //     - before:
      //        - diagnostics show up in: 13.6s (blocking!)
      //        - diagnostics removal in: 13.2s (blocking!)
      //     - after:
      //        - diagnostics show up in: 254ms
      //        - diagnostics removal in: 160.4ms
      //   - first open of a notebook with 10 cells, each with 88 diagnostics:
      //     - before: 2.75s (each time)
      //     - after 208.75ms (order of magnitude faster!)
      //   - first open of a notebook with 100 cells, each with 1 diagnostic
      //       this scenario is expected to have no gain (measures overhead)
      //     - before 280.34ms, 377ms, 399ms
      //     - after 385.29ms, 301.97ms, 309.4ms
      cmEditor.operation(() => {
        const doc = cmEditor.getDoc();
        for (const definition of markerDefinitions) {
          let marker;
          try {
            marker = doc.markText(
              definition.start,
              definition.end,
              definition.options
            );
          } catch (e) {
            this.console.warn(
              'Marking inspection (diagnostic text) failed:',
              definition,
              e
            );
            return;
          }
          this.marked_diagnostics.set(definition.hash, {
            marker,
            editor: cmEditor
          });
        }
      });
    }

    // remove the markers which were not included in the new message
    this.removeUnusedDiagnosticMarkers(markers_to_retain);

    this.diagnostics_db.set(this.virtualDocument, diagnostics_list);
  }

  public handleDiagnostic = (
    response: lsProtocol.PublishDiagnosticsParams,
    document: VirtualDocument
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
      this.setDiagnostics(response, document);
      diagnosticsPanel.update();
    } catch (e) {
      this.console.warn(e);
    }
  };

  public refreshDiagnostics() {
    if (this._lastResponse) {
      this.setDiagnostics(this._lastResponse, this._lastDocument);
    }
    diagnosticsPanel.update();
  }

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

  remove(): void {
    this.settings.changed.disconnect(this.refreshDiagnostics, this);
    // remove all markers
    this.removeUnusedDiagnosticMarkers(new Set());
    this.diagnostics_db.clear();
    diagnostics_databases.delete(this.virtual_editor);
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

  private _lastResponse: lsProtocol.PublishDiagnosticsParams;
  private _lastDocument: VirtualDocument;
}


export namespace DiagnosticsFeature {
  export interface IOptions extends Feature.IOptions {
    settingRegistry: ISettingRegistry;
  }
  export const id = PLUGIN_ID + ':diagnostics';
}