import { VDomModel, VDomRenderer } from '@jupyterlab/apputils';
import { IDocumentWidget } from '@jupyterlab/docregistry';
import { VirtualDocument, WidgetLSPAdapter } from '@jupyterlab/lsp';
import { TranslationBundle } from '@jupyterlab/translation';
import { caretDownIcon, caretUpIcon } from '@jupyterlab/ui-components';
import React, { ReactElement } from 'react';
import * as lsProtocol from 'vscode-languageserver-protocol';

import { CodeDiagnostics as LSPDiagnosticsSettings } from '../../_diagnostics';
import { DocumentLocator } from '../../components/utils';
import { PositionConverter } from '../../converter';
import { FeatureSettings } from '../../feature';
import { DiagnosticSeverity } from '../../lsp';

import { IEditorDiagnostic } from './tokens';

import '../../../style/diagnostics_listing.css';

export const DIAGNOSTICS_LISTING_CLASS = 'lsp-diagnostics-listing';
const DIAGNOSTICS_PLACEHOLDER_CLASS = 'lsp-diagnostics-placeholder';

export class DiagnosticsDatabase extends Map<
  VirtualDocument,
  IEditorDiagnostic[]
> {
  get all(): IEditorDiagnostic[] {
    return [].concat.apply([], this.values() as any);
  }
}

export interface IDiagnosticsRow {
  data: IEditorDiagnostic;
  key: string;
  document: VirtualDocument;
  /**
   * Cell number is the ordinal, 1-based cell identifier displayed to the user.
   */
  cell_number?: number;
}

interface IListingContext {
  db: DiagnosticsDatabase;
  adapter: WidgetLSPAdapter<IDocumentWidget>;
}

interface IColumnOptions {
  id: string;
  label: string;
  render_cell(data: IDiagnosticsRow, context?: IListingContext): ReactElement;
  sort(a: IDiagnosticsRow, b: IDiagnosticsRow): number;
  is_available?(context: IListingContext): boolean;
}

class Column {
  public is_visible: boolean;

  constructor(private options: IColumnOptions) {
    this.is_visible = true;
  }

  render_cell(data: IDiagnosticsRow, context: IListingContext) {
    return this.options.render_cell(data, context);
  }

  sort(a: IDiagnosticsRow, b: IDiagnosticsRow) {
    return this.options.sort(a, b);
  }

  get id(): string {
    return this.options.id;
  }

  is_available(context: IListingContext) {
    if (this.options.is_available != null) {
      return this.options.is_available(context);
    }
    return true;
  }

  render_header(listing: DiagnosticsListing): ReactElement {
    return (
      <SortableTH
        label={this.options.label}
        id={this.id}
        listing={listing}
        key={this.id}
      />
    );
  }
}

function SortableTH(props: {
  id: string;
  label: string;
  listing: DiagnosticsListing;
}): ReactElement {
  const is_sort_key = props.id === props.listing.sort_key;
  const sortIcon =
    !is_sort_key || props.listing.sort_direction === 1
      ? caretUpIcon
      : caretDownIcon;
  return (
    <th
      key={props.id}
      onClick={() => props.listing.sort(props.id)}
      className={is_sort_key ? 'lsp-sorted-header' : undefined}
      data-id={props.id}
    >
      <div>
        <label>{props.label}</label>
        <sortIcon.react tag="span" className="lsp-sort-icon" />
      </div>
    </th>
  );
}

export function message_without_code(diagnostic: lsProtocol.Diagnostic) {
  let message = diagnostic.message;
  let code_str = '' + diagnostic.code;
  if (
    diagnostic.code != null &&
    diagnostic.code !== '' &&
    message.startsWith(code_str + '')
  ) {
    return message.slice(code_str.length).trim();
  }
  return message;
}

export class DiagnosticsListing extends VDomRenderer<DiagnosticsListing.Model> {
  sort_key = 'Severity';
  sort_direction = 1;
  private _diagnostics: Map<string, IDiagnosticsRow>;
  protected trans: TranslationBundle;
  public columns: Column[];
  protected severityTranslations: Record<
    keyof typeof DiagnosticSeverity,
    string
  >;

  constructor(model: DiagnosticsListing.Model) {
    super(model);
    const trans = model.trans;
    this.trans = trans;
    this.severityTranslations = {
      Error: trans.__('Error'),
      Warning: trans.__('Warning'),
      Information: trans.__('Information'),
      Hint: trans.__('Hint')
    };

    this.columns = [
      new Column({
        id: 'Virtual Document',
        label: this.trans.__('Virtual Document'),
        render_cell: (row, context: IListingContext) => (
          <td key={0}>
            <DocumentLocator
              document={row.document}
              adapter={context.adapter}
              trans={this.trans}
            />
          </td>
        ),
        sort: (a, b) => a.document.idPath.localeCompare(b.document.idPath),
        is_available: context => context.db.size > 1
      }),
      new Column({
        id: 'Message',
        label: this.trans.__('Message'),
        render_cell: row => {
          let message = message_without_code(row.data.diagnostic);
          return <td key={1}>{message}</td>;
        },
        sort: (a, b) =>
          a.data.diagnostic.message.localeCompare(b.data.diagnostic.message)
      }),
      new Column({
        id: 'Code',
        label: this.trans.__('Code'),
        render_cell: row => <td key={2}>{row.data.diagnostic.code}</td>,
        sort: (a, b) =>
          (a.data.diagnostic.code + '').localeCompare(
            b.data.diagnostic.source + ''
          )
      }),
      new Column({
        id: 'Severity',
        label: this.trans.__('Severity'),
        // TODO: use default diagnostic severity
        render_cell: row => {
          const severity = DiagnosticSeverity[
            row.data.diagnostic.severity || 1
          ] as keyof typeof DiagnosticSeverity;
          return (
            <td key={3}>{this.severityTranslations[severity] || severity}</td>
          );
        },
        sort: (a, b) => {
          if (!a.data.diagnostic.severity) {
            return +1;
          }
          if (!b.data.diagnostic.severity) {
            return -1;
          }
          return a.data.diagnostic.severity > b.data.diagnostic.severity
            ? 1
            : -1;
        }
      }),
      new Column({
        id: 'Source',
        label: this.trans.__('Source'),
        render_cell: row => <td key={4}>{row.data.diagnostic.source}</td>,
        sort: (a, b) => {
          if (!a.data.diagnostic.source) {
            return +1;
          }
          if (!b.data.diagnostic.source) {
            return -1;
          }
          return a.data.diagnostic.source.localeCompare(
            b.data.diagnostic.source
          );
        }
      }),
      new Column({
        id: 'Cell',
        label: this.trans.__('Cell'),
        render_cell: row => <td key={5}>{row.cell_number}</td>,
        sort: (a, b) =>
          a.cell_number! - b.cell_number! ||
          a.data.range.start.line - b.data.range.start.line ||
          a.data.range.start.ch - b.data.range.start.ch,
        is_available: context => context.adapter.hasMultipleEditors
      }),
      new Column({
        id: 'Line:Ch',
        label: this.trans.__('Line:Ch'),
        render_cell: row => (
          <td key={6}>
            {row.data.range.start.line}:{row.data.range.start.ch}
          </td>
        ),
        sort: (a, b) =>
          a.data.range.start.line - b.data.range.start.line ||
          a.data.range.start.ch - b.data.range.start.ch
      })
    ];
  }

  sort(key: string) {
    if (key === this.sort_key) {
      this.sort_direction = this.sort_direction * -1;
    } else {
      this.sort_key = key;
      this.sort_direction = 1;
    }
    this.update();
  }

  render() {
    let diagnostics_db = this.model.diagnostics;
    const adapter = this.model.adapter;
    if (diagnostics_db == null || !adapter) {
      return (
        <div className={DIAGNOSTICS_PLACEHOLDER_CLASS}>
          {this.trans.__('Diagnostics are not available')}
        </div>
      );
    }
    if (diagnostics_db.size === 0) {
      return (
        <div className={DIAGNOSTICS_PLACEHOLDER_CLASS}>
          {this.trans.__('No issues detected, great job!')}
        </div>
      );
    }

    let by_document = Array.from(diagnostics_db).map(
      ([virtualDocument, diagnostics]) => {
        if (virtualDocument.isDisposed) {
          return [];
        }
        return diagnostics.map((diagnostic_data, i) => {
          let cell_number: number | null = null;
          if (adapter.hasMultipleEditors) {
            const cellIndex = adapter.editors.findIndex(
              value => value.ceEditor.getEditor() == diagnostic_data.editor
            );
            cell_number = cellIndex + 1;
          }
          return {
            data: diagnostic_data,
            key: virtualDocument.uri + ',' + i,
            document: virtualDocument,
            cell_number: cell_number
          } as IDiagnosticsRow;
        });
      }
    );
    let flattened: IDiagnosticsRow[] = ([] as IDiagnosticsRow[]).concat.apply(
      [],
      by_document
    );
    this._diagnostics = new Map(flattened.map(row => [row.key, row]));

    let sorted_column = this.columns.filter(
      column => column.id === this.sort_key
    )[0];
    let sorter = sorted_column.sort.bind(sorted_column);
    let sorted = flattened.sort((a, b) => sorter(a, b) * this.sort_direction);

    let context: IListingContext = {
      db: diagnostics_db,
      adapter: adapter
    };

    let columns_to_display = this.columns.filter(
      column => column.is_available(context) && column.is_visible
    );

    let elements = sorted.map(row => {
      let cells = columns_to_display.map(column =>
        column.render_cell(row, context)
      );

      return (
        <tr
          key={row.key}
          data-key={row.key}
          onClick={() => {
            this.jump_to(row);
          }}
        >
          {cells}
        </tr>
      );
    });

    let columns_headers = columns_to_display.map(column =>
      column.render_header(this)
    );

    return (
      <table className={DIAGNOSTICS_LISTING_CLASS}>
        <thead>
          <tr>{columns_headers}</tr>
        </thead>
        <tbody>{elements}</tbody>
      </table>
    );
  }

  get_diagnostic(key: string): IDiagnosticsRow | undefined {
    if (!this._diagnostics.has(key)) {
      console.warn('Could not find the diagnostics row with key', key);
      return;
    }
    return this._diagnostics.get(key);
  }

  jump_to(row: IDiagnosticsRow) {
    const cm_editor = row.data.editor;
    cm_editor.setCursorPosition(
      PositionConverter.cm_to_ce(row.data.range.start)
    );
    cm_editor.focus();
  }
}

export namespace DiagnosticsListing {
  /**
   * A VDomModel for the LSP of current file editor/notebook.
   */
  export class Model extends VDomModel {
    diagnostics: DiagnosticsDatabase | null;
    adapter: WidgetLSPAdapter<any> | null;
    settings: FeatureSettings<LSPDiagnosticsSettings>;
    trans: TranslationBundle;

    constructor(translator_bundle: TranslationBundle) {
      super();
      this.trans = translator_bundle;
    }
  }
}
