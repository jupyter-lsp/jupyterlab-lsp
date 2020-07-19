import {
  IForeignCodeExtractor,
  IForeignCodeExtractorsRegistry
} from '../extractors/types';
import { CellMagicsMap, LineMagicsMap } from '../magics/maps';
import { IOverridesRegistry } from '../magics/overrides';
import { DefaultMap } from '../utils';
import { Signal } from '@lumino/signaling';
import { CodeEditor } from '@jupyterlab/codeeditor';
import * as CodeMirror from 'codemirror';
import {
  IEditorPosition,
  ISourcePosition,
  IVirtualPosition
} from '../positioning';
import IRange = CodeEditor.IRange;
import { ILSPConnection } from '../tokens';

import { DocumentConnectionManager } from '../connection_manager';

type language = string;

interface IVirtualLine {
  /**
   * Inspections for which document should be skipped for this virtual line?
   */
  skip_inspect: Array<VirtualDocument.id_path>;
  /**
   * Where does the virtual line belongs to in the source document?
   */
  source_line: number;
  editor: CodeMirror.Editor;
}

export interface IVirtualDocumentBlock {
  /**
   * Line corresponding to the block in the entire foreign document
   */
  virtual_line: number;
  virtual_document: VirtualDocument;
}

interface ISourceLine {
  virtual_line: number;
  editor: CodeMirror.Editor;
  // shift
  editor_line: number;
  editor_shift: CodeEditor.IPosition;
  /**
   * Everything which is not in the range of foreign documents belongs to the host.
   */
  foreign_documents_map: Map<IRange, IVirtualDocumentBlock>;
}

export interface IForeignContext {
  foreign_document: VirtualDocument;
  parent_host: VirtualDocument;
}

/**
 * Check if given position is within range.
 * Both start and end are inclusive.
 * @param position
 * @param range
 */
export function is_within_range(
  position: CodeEditor.IPosition,
  range: CodeEditor.IRange
): boolean {
  if (range.start.line === range.end.line) {
    return (
      position.line === range.start.line &&
      position.column >= range.start.column &&
      position.column <= range.end.column
    );
  }

  return (
    (position.line === range.start.line &&
      position.column >= range.start.column &&
      position.line < range.end.line) ||
    (position.line > range.start.line &&
      position.column <= range.end.column &&
      position.line === range.end.line) ||
    (position.line > range.start.line && position.line < range.end.line)
  );
}

/**
 * a virtual implementation of IDocumentInfo
 */
export class VirtualDocumentInfo implements ILSPConnection.IDocumentInfo {
  private _document: VirtualDocument;
  version = 0;

  constructor(document: VirtualDocument) {
    this._document = document;
  }

  get text() {
    return this._document.value;
  }

  get uri() {
    const uris = DocumentConnectionManager.solve_uris(
      this._document,
      this.languageId
    );
    return uris.document;
  }

  get languageId() {
    return this._document.language;
  }
}

/**
 * A notebook can hold one or more virtual documents; there is always one,
 * "root" document, corresponding to the language of the kernel. All other
 * virtual documents are extracted out of the notebook, based on magics,
 * or other syntax constructs, depending on the kernel language.
 *
 * Virtual documents represent the underlying code in a single language,
 * which has been parsed excluding interactive kernel commands (magics)
 * which could be misunderstood by the specific LSP server.
 *
 * VirtualDocument has no awareness of the notebook or editor it lives in,
 * however it is able to transform its content back to the notebook space,
 * as it keeps editor coordinates for each virtual line.
 *
 * The notebook/editor aware transformations are preferred to be placed in
 * VirtualEditor descendants rather than here.
 */
export class VirtualDocument {
  public language: string;
  public last_virtual_line: number;
  public foreign_document_closed: Signal<VirtualDocument, IForeignContext>;
  public foreign_document_opened: Signal<VirtualDocument, IForeignContext>;
  public readonly instance_id: number;
  public standalone: boolean;
  isDisposed = false;
  /**
   * the remote document uri, version and other server-related info
   */
  public document_info: ILSPConnection.IDocumentInfo;
  /**
   * Virtual lines keep all the lines present in the document AND extracted to the foreign document.
   */
  public virtual_lines: Map<number, IVirtualLine>; // probably should go protected
  protected source_lines: Map<number, ISourceLine>;

  protected foreign_extractors: IForeignCodeExtractor[];
  protected overrides_registry: IOverridesRegistry;
  protected foreign_extractors_registry: IForeignCodeExtractorsRegistry;
  protected lines: Array<string>;

  // TODO: merge into unused documents {standalone: Map, continuous: Map} ?
  protected unused_documents: Set<VirtualDocument>;
  protected unused_standalone_documents: DefaultMap<
    language,
    Array<VirtualDocument>
  >;

  private _remaining_lifetime: number;
  private cell_magics_overrides: CellMagicsMap;
  private line_magics_overrides: LineMagicsMap;
  private static instances_count = 0;
  public foreign_documents: Map<VirtualDocument.virtual_id, VirtualDocument>;

  // TODO: make this configurable, depending on the language used
  blank_lines_between_cells: number = 2;
  last_source_line: number;
  private previous_value: string;
  public changed: Signal<VirtualDocument, VirtualDocument>;

  constructor(
    language: string,
    public path: string,
    overrides_registry: IOverridesRegistry,
    foreign_code_extractors: IForeignCodeExtractorsRegistry,
    standalone: boolean,
    public file_extension: string,
    public has_lsp_supported_file: boolean,
    public parent?: VirtualDocument
  ) {
    this.language = language;
    let overrides =
      language in overrides_registry ? overrides_registry[language] : null;
    this.cell_magics_overrides = new CellMagicsMap(
      overrides ? overrides.cell_magics : []
    );
    this.line_magics_overrides = new LineMagicsMap(
      overrides ? overrides.line_magics : []
    );
    this.foreign_extractors_registry = foreign_code_extractors;
    this.foreign_extractors =
      this.language in this.foreign_extractors_registry
        ? this.foreign_extractors_registry[this.language]
        : [];
    this.virtual_lines = new Map();
    this.source_lines = new Map();
    this.foreign_documents = new Map();
    this.overrides_registry = overrides_registry;
    this.standalone = standalone;
    this.instance_id = VirtualDocument.instances_count;
    VirtualDocument.instances_count += 1;
    this.unused_standalone_documents = new DefaultMap(
      () => new Array<VirtualDocument>()
    );
    this._remaining_lifetime = 10;
    this.foreign_document_closed = new Signal(this);
    this.foreign_document_opened = new Signal(this);
    this.changed = new Signal(this);
    this.unused_documents = new Set();
    this.document_info = new VirtualDocumentInfo(this);
    this.clear();
  }

  dispose() {
    if (this.isDisposed) {
      return;
    }

    this.parent = null;

    for (const doc of this.foreign_documents.values()) {
      doc.dispose();
    }

    this.close_all_foreign_documents();

    // clear all the maps
    this.foreign_documents.clear();
    this.source_lines.clear();
    this.unused_documents.clear();
    this.unused_standalone_documents.clear();
    this.virtual_lines.clear();

    // just to be sure
    this.cell_magics_overrides = null;
    this.document_info = null;
    this.foreign_extractors = null;
    this.foreign_extractors_registry = null;
    this.line_magics_overrides = null;
    this.lines = null;
    this.overrides_registry = null;

    // actually disposed now
    this.isDisposed = true;
  }

  /**
   * When this counter goes down to 0, the document will be destroyed and the associated connection will be closed;
   * This is meant to reduce the number of open connections when a a foreign code snippet was removed from the document.
   *
   * Note: top level virtual documents are currently immortal (unless killed by other means); it might be worth
   * implementing culling of unused documents, but if and only if JupyterLab will also implement culling of
   * idle kernels - otherwise the user experience could be a bit inconsistent, and we would need to invent our own rules.
   */
  protected get remaining_lifetime() {
    if (!this.parent) {
      return Infinity;
    }
    return this._remaining_lifetime;
  }
  protected set remaining_lifetime(value: number) {
    if (this.parent) {
      this._remaining_lifetime = value;
    }
  }

  clear() {
    // TODO - deep clear (assure that there is no memory leak)
    this.unused_standalone_documents.clear();

    for (let document of this.foreign_documents.values()) {
      document.clear();
      if (document.standalone) {
        // once the standalone document was cleared, we may want to remove it and close connection;
        // but wait, this is a waste of resources (opening a connection takes 1-3 seconds) and,
        // since this is cleaned anyway, we could use it for another standalone document of the same language.
        let set = this.unused_standalone_documents.get(document.language);
        set.push(document);
      }
    }
    this.unused_documents = new Set(this.foreign_documents.values());
    this.virtual_lines.clear();
    this.source_lines.clear();
    this.last_virtual_line = 0;
    this.last_source_line = 0;
    this.lines = [];
  }

  private forward_closed_signal(
    host: VirtualDocument,
    context: IForeignContext
  ) {
    this.foreign_document_closed.emit(context);
  }

  private forward_opened_signal(
    host: VirtualDocument,
    context: IForeignContext
  ) {
    this.foreign_document_opened.emit(context);
  }

  // TODO: what could be refactored into "ForeignDocumentsManager" has started to emerge;
  //   we should consider refactoring later on.
  private open_foreign(
    language: language,
    standalone: boolean,
    file_extension: string
  ): VirtualDocument {
    let document = new VirtualDocument(
      language,
      this.path,
      this.overrides_registry,
      this.foreign_extractors_registry,
      standalone,
      file_extension,
      false,
      this
    );
    const context: IForeignContext = {
      foreign_document: document,
      parent_host: this
    };
    this.foreign_document_opened.emit(context);
    // pass through any future signals
    document.foreign_document_closed.connect(this.forward_closed_signal, this);
    document.foreign_document_opened.connect(this.forward_opened_signal, this);

    this.foreign_documents.set(document.virtual_id, document);

    return document;
  }

  document_at_source_position(position: ISourcePosition): VirtualDocument {
    let source_line = this.source_lines.get(position.line);

    if (source_line == null) {
      return this;
    }

    let source_position_ce: CodeEditor.IPosition = {
      line: source_line.editor_line,
      column: position.ch
    };

    for (let [
      range,
      { virtual_document: document }
    ] of source_line.foreign_documents_map) {
      if (is_within_range(source_position_ce, range)) {
        let source_position_cm = {
          line: source_position_ce.line - range.start.line,
          ch: source_position_ce.column - range.start.column
        };

        return document.document_at_source_position(
          source_position_cm as ISourcePosition
        );
      }
    }

    return this;
  }

  is_within_foreign(source_position: ISourcePosition): boolean {
    let source_line = this.source_lines.get(source_position.line);

    let source_position_ce: CodeEditor.IPosition = {
      line: source_line.editor_line,
      column: source_position.ch
    };
    for (let [range] of source_line.foreign_documents_map) {
      if (is_within_range(source_position_ce, range)) {
        return true;
      }
    }
    return false;
  }

  virtual_position_at_document(
    source_position: ISourcePosition
  ): IVirtualPosition {
    let source_line = this.source_lines.get(source_position.line);
    let virtual_line = source_line.virtual_line;

    // position inside the cell (block)
    let source_position_ce: CodeEditor.IPosition = {
      line: source_line.editor_line,
      column: source_position.ch
    };

    for (let [
      range,
      { virtual_line, virtual_document: document }
    ] of source_line.foreign_documents_map) {
      if (is_within_range(source_position_ce, range)) {
        // position inside the foreign document block
        let source_position_cm = {
          line: source_position_ce.line - range.start.line,
          ch: source_position_ce.column - range.start.column
        };
        if (document.is_within_foreign(source_position_cm as ISourcePosition)) {
          return this.virtual_position_at_document(
            source_position_cm as ISourcePosition
          );
        } else {
          // where in this block in the entire foreign document?
          source_position_cm.line += virtual_line;
          return source_position_cm as IVirtualPosition;
        }
      }
    }

    return {
      ch: source_position.ch,
      line: virtual_line
    } as IVirtualPosition;
  }

  private choose_foreign_document(extractor: IForeignCodeExtractor) {
    let foreign_document: VirtualDocument;
    // if not standalone, try to append to existing document
    let foreign_exists = this.foreign_documents.has(extractor.language);
    if (!extractor.standalone && foreign_exists) {
      foreign_document = this.foreign_documents.get(extractor.language);
      this.unused_documents.delete(foreign_document);
    } else {
      // if standalone, try to re-use existing connection to the server
      let unused_standalone = this.unused_standalone_documents.get(
        extractor.language
      );
      if (extractor.standalone && unused_standalone.length > 0) {
        foreign_document = unused_standalone.pop();
        this.unused_documents.delete(foreign_document);
      } else {
        // if (previous document does not exists) or (extractor produces standalone documents
        // and no old standalone document could be reused): create a new document
        foreign_document = this.open_foreign(
          extractor.language,
          extractor.standalone,
          extractor.file_extension
        );
      }
    }
    return foreign_document;
  }

  extract_foreign_code(
    cell_code: string,
    cm_editor: CodeMirror.Editor,
    editor_shift: CodeEditor.IPosition
  ) {
    let foreign_document_map = new Map<
      CodeEditor.IRange,
      IVirtualDocumentBlock
    >();

    for (let extractor of this.foreign_extractors) {
      // first, check if there is any foreign code:

      if (!extractor.has_foreign_code(cell_code)) {
        continue;
      }

      let results = extractor.extract_foreign_code(cell_code);

      let kept_cell_code = '';

      for (let result of results) {
        if (result.foreign_code !== null) {
          let foreign_document = this.choose_foreign_document(extractor);

          foreign_document_map.set(result.range, {
            virtual_line: foreign_document.last_virtual_line,
            virtual_document: foreign_document
          });
          let foreign_shift = {
            line: editor_shift.line + result.range.start.line,
            column: editor_shift.column + result.range.start.column
          };
          foreign_document.append_code_block(
            result.foreign_code,
            cm_editor,
            foreign_shift,
            result.virtual_shift
          );
        }
        if (result.host_code != null) {
          kept_cell_code += result.host_code;
        }
      }
      // not breaking - many extractors are allowed to process the code, one after each other
      // (think JS and CSS in HTML, or %R inside of %%timeit).

      cell_code = kept_cell_code;
    }

    return { cell_code_kept: cell_code, foreign_document_map };
  }

  decode_code_block(raw_code: string): string {
    // TODO: add back previously extracted foreign code
    let cell_override = this.cell_magics_overrides.reverse.override_for(
      raw_code
    );
    if (cell_override != null) {
      return cell_override;
    } else {
      let lines = this.line_magics_overrides.reverse_replace_all(
        raw_code.split('\n')
      );
      return lines.join('\n');
    }
  }

  prepare_code_block(
    cell_code: string,
    cm_editor: CodeMirror.Editor,
    editor_shift: CodeEditor.IPosition = { line: 0, column: 0 }
  ) {
    let lines: Array<string>;
    let skip_inspect: Array<Array<VirtualDocument.id_path>>;

    let { cell_code_kept, foreign_document_map } = this.extract_foreign_code(
      cell_code,
      cm_editor,
      editor_shift
    );
    cell_code = cell_code_kept;

    // cell magics are replaced if requested and matched
    let cell_override = this.cell_magics_overrides.override_for(cell_code);
    if (cell_override != null) {
      lines = cell_override.split('\n');
      skip_inspect = lines.map(l => [this.id_path]);
    } else {
      // otherwise, we replace line magics - if any
      let result = this.line_magics_overrides.replace_all(
        cell_code.split('\n')
      );
      lines = result.lines;
      skip_inspect = result.skip_inspect.map(skip =>
        skip ? [this.id_path] : []
      );
    }

    return { lines, foreign_document_map, skip_inspect };
  }

  append_code_block(
    cell_code: string,
    cm_editor: CodeMirror.Editor,
    editor_shift: CodeEditor.IPosition = { line: 0, column: 0 },
    virtual_shift?: CodeEditor.IPosition
  ) {
    let source_cell_lines = cell_code.split('\n');

    let { lines, foreign_document_map, skip_inspect } = this.prepare_code_block(
      cell_code,
      cm_editor,
      editor_shift
    );

    for (let i = 0; i < lines.length; i++) {
      this.virtual_lines.set(this.last_virtual_line + i, {
        skip_inspect: skip_inspect[i],
        editor: cm_editor,
        // TODO this is incorrect, wont work if something was extracted
        source_line: this.last_source_line + i
      });
    }
    for (let i = 0; i < source_cell_lines.length; i++) {
      this.source_lines.set(this.last_source_line + i, {
        editor_line: i,
        editor_shift: {
          line: editor_shift.line - (virtual_shift?.line || 0),
          column:
            i === 0 ? editor_shift.column - (virtual_shift?.column || 0) : 0
        },
        // TODO: move those to a new abstraction layer (DocumentBlock class)
        editor: cm_editor,
        foreign_documents_map: foreign_document_map,
        // TODO this is incorrect, wont work if something was extracted
        virtual_line: this.last_virtual_line + i
      });
    }

    this.last_virtual_line += lines.length;

    // one empty line is necessary to separate code blocks, next 'n' lines are to silence linters;
    // the final cell does not get the additional lines (thanks to the use of join, see below)
    this.lines.push(lines.join('\n') + '\n');

    // adding the virtual lines for the blank lines
    for (let i = 0; i < this.blank_lines_between_cells; i++) {
      this.virtual_lines.set(this.last_virtual_line + i, {
        skip_inspect: [this.id_path],
        editor: cm_editor,
        source_line: null
      });
    }

    this.last_virtual_line += this.blank_lines_between_cells;
    this.last_source_line += source_cell_lines.length;
  }

  get value() {
    let lines_padding = '\n'.repeat(this.blank_lines_between_cells);
    return this.lines.join(lines_padding);
  }

  getTokenAt(position: IVirtualPosition): CodeMirror.Token {
    let cm_editor = this.get_editor_at_virtual_line(position);
    let editor_position = this.transform_virtual_to_editor(position);
    return cm_editor.getTokenAt(editor_position);
  }

  close_expired_documents() {
    for (let document of this.unused_documents.values()) {
      document.remaining_lifetime -= 1;
      if (document.remaining_lifetime <= 0) {
        this.close_foreign(document);
      }
    }
  }

  close_foreign(document: VirtualDocument) {
    console.log('LSP: closing document', document);
    this.foreign_document_closed.emit({
      foreign_document: document,
      parent_host: this
    });
    // remove it from foreign documents list
    this.foreign_documents.delete(document.virtual_id);
    // and delete the documents within it
    document.close_all_foreign_documents();

    document.foreign_document_closed.disconnect(
      this.forward_closed_signal,
      this
    );
    document.foreign_document_opened.disconnect(
      this.forward_opened_signal,
      this
    );
  }

  close_all_foreign_documents() {
    for (let document of this.foreign_documents.values()) {
      this.close_foreign(document);
    }
  }

  get virtual_id(): VirtualDocument.virtual_id {
    // for easier debugging, the language information is included in the ID:
    return this.standalone
      ? this.instance_id + '(' + this.language + ')'
      : this.language;
  }

  get ancestry(): Array<VirtualDocument> {
    if (!this.parent) {
      return [this];
    }
    return this.parent.ancestry.concat([this]);
  }

  get id_path(): VirtualDocument.id_path {
    if (!this.parent) {
      return this.virtual_id;
    }
    return this.parent.id_path + '-' + this.virtual_id;
  }

  get uri(): string {
    if (!this.parent) {
      return this.path;
    }
    return this.path + '.' + this.id_path + '.' + this.file_extension;
  }

  transform_source_to_editor(pos: ISourcePosition): IEditorPosition {
    let source_line = this.source_lines.get(pos.line);
    let editor_line = source_line.editor_line;
    let editor_shift = source_line.editor_shift;
    return {
      // only shift column in the line beginning the virtual document (first list of the editor in cell magics, but might be any line of editor in line magics!)
      ch: pos.ch + (editor_line === 0 ? editor_shift.column : 0),
      line: editor_line + editor_shift.line
      // TODO or:
      //  line: pos.line + editor_shift.line - this.first_line_of_the_block(editor)
    } as IEditorPosition;
  }

  transform_virtual_to_editor(
    virtual_position: IVirtualPosition
  ): IEditorPosition {
    let source_position = this.transform_virtual_to_source(virtual_position);
    return this.transform_source_to_editor(source_position);
  }

  transform_virtual_to_source(position: IVirtualPosition): ISourcePosition {
    return {
      ch: position.ch,
      line: this.virtual_lines.get(position.line).source_line
    } as ISourcePosition;
  }

  get root(): VirtualDocument {
    if (this.parent == null) {
      return this;
    }
    return this.parent.root;
  }

  get_editor_at_virtual_line(pos: IVirtualPosition): CodeMirror.Editor {
    let line = pos.line;
    // tolerate overshot by one (the hanging blank line at the end)
    if (!this.virtual_lines.has(line)) {
      line -= 1;
    }
    return this.virtual_lines.get(line).editor;
  }

  get_editor_at_source_line(pos: CodeMirror.Position): CodeMirror.Editor {
    return this.source_lines.get(pos.line).editor;
  }

  /**
   * Recursively emits changed signal from the document or any descendant foreign document.
   */
  maybe_emit_changed() {
    if (this.value !== this.previous_value) {
      this.changed.emit(this);
    }
    this.previous_value = this.value;
    for (let document of this.foreign_documents.values()) {
      document.maybe_emit_changed();
    }
  }
}

export namespace VirtualDocument {
  /**
   * Identifier composed of `virtual_id`s of a nested structure of documents,
   * used to aide assignment of the connection to the virtual document
   * handling specific, nested language usage; it will be appended to the file name
   * when creating a connection.
   */
  export type id_path = string;
  /**
   * Instance identifier for standalone documents (snippets), or language identifier
   * for documents which should be interpreted as one when stretched across cells.
   */
  export type virtual_id = string;
}

export function collect_documents(
  virtual_document: VirtualDocument
): Set<VirtualDocument> {
  let collected = new Set<VirtualDocument>();
  collected.add(virtual_document);
  for (let foreign of virtual_document.foreign_documents.values()) {
    let foreign_languages = collect_documents(foreign);
    foreign_languages.forEach(collected.add, collected);
  }
  return collected;
}
