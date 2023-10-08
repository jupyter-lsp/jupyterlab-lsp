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
import { IFeatureSettings } from '../../feature';
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
  cellNumber?: number;
}

interface IListingContext {
  db: DiagnosticsDatabase;
  adapter: WidgetLSPAdapter<IDocumentWidget>;
}

interface IColumnOptions {
  id: string;
  label: string;
  renderCell(data: IDiagnosticsRow, context?: IListingContext): ReactElement;
  sort(a: IDiagnosticsRow, b: IDiagnosticsRow): number;
  isAvailable?(context: IListingContext): boolean;
}

class Column {
  public isVisible: boolean;

  constructor(private options: IColumnOptions) {
    this.isVisible = true;
  }

  renderCell(data: IDiagnosticsRow, context: IListingContext) {
    return this.options.renderCell(data, context);
  }

  sort(a: IDiagnosticsRow, b: IDiagnosticsRow) {
    return this.options.sort(a, b);
  }

  get id(): string {
    return this.options.id;
  }

  isAvailable(context: IListingContext) {
    if (this.options.isAvailable != null) {
      return this.options.isAvailable(context);
    }
    return true;
  }

  renderHeader(listing: DiagnosticsListing): ReactElement {
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
  const isSortKey = props.id === props.listing.sortKey;
  const sortIcon =
    !isSortKey || props.listing.sortDirection === 1
      ? caretUpIcon
      : caretDownIcon;
  return (
    <th
      key={props.id}
      onClick={() => props.listing.sort(props.id)}
      className={isSortKey ? 'lsp-sorted-header' : undefined}
      data-id={props.id}
    >
      <div>
        <label>{props.label}</label>
        <sortIcon.react tag="span" className="lsp-sort-icon" />
      </div>
    </th>
  );
}

export function messageWithoutCode(diagnostic: lsProtocol.Diagnostic) {
  let message = diagnostic.message;
  let codeString = '' + diagnostic.code;
  if (
    diagnostic.code != null &&
    diagnostic.code !== '' &&
    message.startsWith(codeString + '')
  ) {
    return message.slice(codeString.length).trim();
  }
  return message;
}

export class DiagnosticsListing extends VDomRenderer<DiagnosticsListing.Model> {
  sortKey = 'Severity';
  sortDirection = 1;
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
        renderCell: (row, context: IListingContext) => (
          <td key={0}>
            <DocumentLocator
              document={row.document}
              adapter={context.adapter}
              trans={this.trans}
            />
          </td>
        ),
        sort: (a, b) => a.document.idPath.localeCompare(b.document.idPath),
        isAvailable: context => context.db.size > 1
      }),
      new Column({
        id: 'Message',
        label: this.trans.__('Message'),
        renderCell: row => {
          let message = messageWithoutCode(row.data.diagnostic);
          return <td key={1}>{message}</td>;
        },
        sort: (a, b) =>
          a.data.diagnostic.message.localeCompare(b.data.diagnostic.message)
      }),
      new Column({
        id: 'Code',
        label: this.trans.__('Code'),
        renderCell: row => <td key={2}>{row.data.diagnostic.code}</td>,
        sort: (a, b) =>
          (a.data.diagnostic.code + '').localeCompare(
            b.data.diagnostic.source + ''
          )
      }),
      new Column({
        id: 'Severity',
        label: this.trans.__('Severity'),
        // TODO: use default diagnostic severity
        renderCell: row => {
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
        renderCell: row => <td key={4}>{row.data.diagnostic.source}</td>,
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
        renderCell: row => <td key={5}>{row.cellNumber}</td>,
        sort: (a, b) =>
          a.cellNumber! - b.cellNumber! ||
          a.data.range.start.line - b.data.range.start.line ||
          a.data.range.start.ch - b.data.range.start.ch,
        isAvailable: context => context.adapter.hasMultipleEditors
      }),
      new Column({
        id: 'Line:Ch',
        label: this.trans.__('Line:Ch'),
        renderCell: row => (
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
    if (key === this.sortKey) {
      this.sortDirection = this.sortDirection * -1;
    } else {
      this.sortKey = key;
      this.sortDirection = 1;
    }
    this.update();
  }

  render() {
    let diagnosticsDatabase = this.model.diagnostics;
    const adapter = this.model.adapter;
    if (diagnosticsDatabase == null || !adapter) {
      return (
        <div className={DIAGNOSTICS_PLACEHOLDER_CLASS}>
          <h3>No diagnostics</h3>
          {this.trans.__(
            'Diagnostics panel shows linting results in notebooks and files connected to a language server.'
          )}
        </div>
      );
    }
    if (diagnosticsDatabase.size === 0) {
      return (
        <div className={DIAGNOSTICS_PLACEHOLDER_CLASS}>
          {this.trans.__('No issues detected, great job!')}
        </div>
      );
    }

    let byDocument = Array.from(diagnosticsDatabase).map(
      ([virtualDocument, diagnostics]) => {
        if (virtualDocument.isDisposed) {
          return [];
        }
        return diagnostics.map((diagnosticData, i) => {
          let cellNumber: number | null = null;
          if (adapter.hasMultipleEditors) {
            const cellIndex = adapter.editors.findIndex(
              value => value.ceEditor == diagnosticData.editorAccessor
            );
            cellNumber = cellIndex + 1;
          }
          return {
            data: diagnosticData,
            key: virtualDocument.uri + ',' + i,
            document: virtualDocument,
            cellNumber: cellNumber
          } as IDiagnosticsRow;
        });
      }
    );
    let flattened: IDiagnosticsRow[] = ([] as IDiagnosticsRow[]).concat.apply(
      [],
      byDocument
    );
    this._diagnostics = new Map(flattened.map(row => [row.key, row]));

    let sortedColumn = this.columns.filter(
      column => column.id === this.sortKey
    )[0];
    let sorter = sortedColumn.sort.bind(sortedColumn);
    let sorted = flattened.sort((a, b) => sorter(a, b) * this.sortDirection);

    let context: IListingContext = {
      db: diagnosticsDatabase,
      adapter: adapter
    };

    let columnsToDisplay = this.columns.filter(
      column => column.isAvailable(context) && column.isVisible
    );

    let elements = sorted.map(row => {
      let cells = columnsToDisplay.map(column =>
        column.renderCell(row, context)
      );

      return (
        <tr
          key={row.key}
          data-key={row.key}
          onClick={() => {
            return this.jumpTo(row);
          }}
        >
          {cells}
        </tr>
      );
    });

    let columnsHeaders = columnsToDisplay.map(column =>
      column.renderHeader(this)
    );

    return (
      <table className={DIAGNOSTICS_LISTING_CLASS}>
        <thead>
          <tr>{columnsHeaders}</tr>
        </thead>
        <tbody>{elements}</tbody>
      </table>
    );
  }

  getDiagnostic(key: string): IDiagnosticsRow | undefined {
    if (!this._diagnostics.has(key)) {
      console.warn('Could not find the diagnostics row with key', key);
      return;
    }
    return this._diagnostics.get(key);
  }

  async jumpTo(row: IDiagnosticsRow): Promise<void> {
    const editor = await row.data.editorAccessor.reveal();
    editor.setCursorPosition(PositionConverter.cm_to_ce(row.data.range.start));
    editor.focus();
  }
}

export namespace DiagnosticsListing {
  /**
   * A VDomModel for the LSP of current file editor/notebook.
   */
  export class Model extends VDomModel {
    diagnostics: DiagnosticsDatabase | null;
    adapter: WidgetLSPAdapter<any> | null;
    settings: IFeatureSettings<LSPDiagnosticsSettings>;
    trans: TranslationBundle;

    constructor(translatorBundle: TranslationBundle) {
      super();
      this.trans = translatorBundle;
    }
  }
}
