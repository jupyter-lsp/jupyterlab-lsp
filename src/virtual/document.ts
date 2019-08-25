import {
  IForeignCodeExtractor,
  IForeignCodeExtractorsRegistry
} from '../extractors/types';
import { CellMagicsMap, LineMagicsMap } from '../magics/maps';
import { IOverridesRegistry } from '../magics/overrides';
import { DefaultMap } from '../utils';
import CodeMirror = require('codemirror');
import { Signal } from '@phosphor/signaling';

interface IEditorCoordinates {
  editor: CodeMirror.Editor;
  line_shift: number;
}

interface IVirtualLine {
  editor_coordinates: IEditorCoordinates;
  /**
   * Should inspections for this virtual line be presented?
   */
  inspect: boolean;
}

type language = string;

interface IForeignContext {
  foreign_document: VirtualDocument;
  parent_host: VirtualDocument;
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
  public last_line: number;
  public foreign_document_closed: Signal<VirtualDocument, IForeignContext>;
  public foreign_document_opened: Signal<VirtualDocument, IForeignContext>;
  public readonly instance_id: number;
  public standalone: boolean;
  public virtual_lines: Map<number, IVirtualLine>; // probably should go protected

  protected foreign_extractors: IForeignCodeExtractor[];
  protected overrides_registry: IOverridesRegistry;
  protected foreign_extractors_registry: IForeignCodeExtractorsRegistry;
  protected lines: Array<string>;

  // TODO: merge into unused documents {standalone: Map, continuous: Map} ?
  protected unused_documents: Set<VirtualDocument>;
  protected unused_standalone_documents: DefaultMap<language, Array<VirtualDocument>>;

  private readonly parent: VirtualDocument;
  private _remaining_lifetime: number;
  private cell_magics_overrides: CellMagicsMap;
  private line_magics_overrides: LineMagicsMap;
  private static instances_count = 0;
  private foreign_documents: Map<VirtualDocument.virtual_id, VirtualDocument>;

  // TODO: make this configurable, depending on the language used
  blank_lines_between_cells: number = 2;

  /* Ideas
  signal: on foreign document added
   */

  constructor(
    language: string,
    overrides_registry: IOverridesRegistry,
    foreign_code_extractors: IForeignCodeExtractorsRegistry,
    standalone: boolean,
    parent?: VirtualDocument
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
    this.parent = parent;
    this.virtual_lines = new Map();
    this.foreign_documents = new Map();
    this.overrides_registry = overrides_registry;
    this.lines = [];
    this.standalone = standalone;
    this.instance_id = VirtualDocument.instances_count;
    VirtualDocument.instances_count += 1;
    this.unused_standalone_documents = new DefaultMap(
      () => new Array<VirtualDocument>()
    );
    this._remaining_lifetime = 10;
    this.foreign_document_closed = new Signal(this);
    this.foreign_document_opened = new Signal(this);
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
    this.last_line = 0;
    this.lines = [];
  }

  private forward_closed_signal(host: VirtualDocument, context: IForeignContext) {
    this.foreign_document_closed.emit(context);
  }

  private forward_opened_signal(host: VirtualDocument, context: IForeignContext) {
    this.foreign_document_opened.emit(context);
  }

  // TODO: what could be refactored into "ForeignDocumentsManager" has started to emerge;
  //   we should consider refactoring later on.
  private open_foreign(
    language: language,
    standalone: boolean
  ): VirtualDocument {
    let document = new VirtualDocument(
      language,
      this.overrides_registry,
      this.foreign_extractors_registry,
      standalone
    );
    this.foreign_document_opened.emit({
      foreign_document: document,
      parent_host: this
    });
    // pass through any future signals
    document.foreign_document_closed.connect(this.forward_closed_signal);
    document.foreign_document_opened.connect(this.forward_opened_signal);

    this.foreign_documents.set(document.virtual_id, document);

    return document;
  }

  append_code_block(
    cell_code: string,
    cm_editor: CodeMirror.Editor
  ): Map<number, VirtualDocument> {
    let lines: Array<string>;
    let should_inspect: Array<boolean>;
    let line_document_map = new Map<number, VirtualDocument>();

    //  TODO: create additional LSP servers for foreign languages introduced in cell magics

    // first, check if there is any foreign code:
    // let is_line_foreign = new Array<boolean>();
    for (let extractor of this.foreign_extractors) {
      let result = extractor.extract_foreign_code(cell_code);
      if (result.foreign_code === null) {
        continue;
      }

      let foreign_document: VirtualDocument;
      // if not standalone, try to append to existing document
      let foreign_exists = this.foreign_documents.has(extractor.language);
      if (!extractor.standalone && foreign_exists) {
        foreign_document = this.foreign_documents.get(extractor.language);
      } else {
        // if standalone, try to re-use existing connection to the server
        let unused_standalone = this.unused_standalone_documents.get(
          extractor.language
        );
        if (extractor.standalone && unused_standalone.length > 0) {
          foreign_document = unused_standalone.pop();
        } else {
          // if (previous document does not exists) or (extractor produces standalone documents
          // and no old standalone document could be reused): create a new document
          foreign_document = this.open_foreign(
            extractor.language,
            extractor.standalone
          );
        }
      }

      // TODO
      // result.foreign_coordinates;
      foreign_document.append_code_block(result.foreign_code, cm_editor);
      cell_code = result.host_code;

      // not breaking - many extractors are allowed to process the code, one after each other
      // (think JS and CSS in HTML, or %R inside of %%timeit).
    }

    // cell magics are replaced if requested and matched
    let cell_override = this.cell_magics_overrides.override_for(cell_code);
    if (cell_override !== null) {
      lines = cell_override.split('\n');
      should_inspect = lines.map(l => false);
    } else {
      // otherwise, we replace line magics - if any
      let result = this.line_magics_overrides.replace_all(
        cell_code.split('\n')
      );
      lines = result.lines;
      should_inspect = result.should_inspect;
    }

    for (let i = 0; i < lines.length; i++) {
      this.virtual_lines.set(this.last_line + i, {
        editor_coordinates: {
          editor: cm_editor,
          line_shift: this.last_line
        },
        inspect: should_inspect[i]
      });
    }

    // one empty line is necessary to separate code blocks, next 'n' lines are to silence linters;
    // the final cell does not get the additional lines (thanks to the use of join, see below)
    this.lines.push(lines.join('\n') + '\n');

    this.last_line += lines.length + this.blank_lines_between_cells;

    return line_document_map;
  }

  get value() {
    let lines_padding = '\n'.repeat(this.blank_lines_between_cells);
    // TODO: require the editor to do this
    // once all the foreign documents were refreshed, the unused documents (and their connections)
    // should be terminated if their lifetime expired
    this.close_expired_documents();
    return this.lines.join(lines_padding);
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
    this.foreign_document_closed.emit({
      foreign_document: document,
      parent_host: this
    });
    // remove it from foreign documents list
    this.foreign_documents.delete(document.virtual_id);
    // and delete the documents within it
    document.close_all_foreign_documents();

    document.foreign_document_closed.disconnect(this.forward_closed_signal);
    document.foreign_document_opened.disconnect(this.forward_opened_signal);
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

  get id_path(): VirtualDocument.id_path {
    if (!this.parent) {
      return this.virtual_id;
    }
    return this.parent.id_path + '-' + this.virtual_id;
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
