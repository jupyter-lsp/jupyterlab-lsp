import {IForeignCodeExtractor, IForeignCodeExtractorsRegistry} from '../extractors/types';
import { CellMagicsMap, LineMagicsMap } from '../magics/maps';
import { IOverridesRegistry } from '../magics/overrides';
import CodeMirror = require('codemirror');

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

/**
 * A notebook can hold one or more virtual documents.
 *
 * Virtual documents represent the underlying code in a single language,
 * which has been parsed excluding interactive kernel commands (magics)
 * which could be misunderstood by the specific LSP server.
 *
 * VirtualDocument has minimal awareness of the notebook,
 * being able to transform its content back to the notebook space.
 */
export class VirtualDocument {
  parent: VirtualDocument;
  language: string;
  foreign_documents: Map<string, VirtualDocument>;
  foreign_extractors: IForeignCodeExtractor[];
  virtual_lines: Map<number, IVirtualLine>;

  cell_magics_overrides: CellMagicsMap;
  line_magics_overrides: LineMagicsMap;

  overrides_registry: IOverridesRegistry;
  foreign_extractors_registry: IForeignCodeExtractorsRegistry;

  last_line: number;
  lines: Array<string>;

  // TODO: make this configurable, depending on the language used
  blank_lines_between_cells: number = 2;

  /* Ideas
  signal: on foreign document added
   */

  constructor(
    language: string,
    overrides_registry: IOverridesRegistry,
    foreign_code_extractors: IForeignCodeExtractorsRegistry,
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
  }

  clear() {
    this.virtual_lines.clear();
    this.last_line = 0;
    this.lines = [];
  }

  append_code_block(cell_code: string, cm_editor: CodeMirror.Editor) {
    let lines: Array<string>;
    let should_inspect: Array<boolean>;
    //  TODO: create additional LSP servers for foreign languages introduced in cell magics

    // first, check if there is any foreign code:
    // let is_line_foreign = new Array<boolean>();
    for (let extractor of this.foreign_extractors) {
      let result = extractor.extract_foreign_code(cell_code);
      if (result.foreign_code === null) {
        continue;
      }

      let foreign_document: VirtualDocument;
      if (this.foreign_documents.has(extractor.language)) {
        foreign_document = this.foreign_documents.get(extractor.language);
      } else {
        foreign_document = new VirtualDocument(
          extractor.language,
          this.overrides_registry,
          this.foreign_extractors_registry
        );
        this.foreign_documents.set(extractor.language, foreign_document);
      }

      // TODO
      // result.foreign_coordinates;
      foreign_document.append_code_block(result.foreign_code, cm_editor);
      cell_code = result.host_code;
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
  }

  get value() {
    let lines_padding = '\n'.repeat(this.blank_lines_between_cells);
    return this.lines.join(lines_padding);
  }

  get virtual_identifier_suffix(): VirtualDocument.virtual_identifier_suffix {
    if (!this.parent) {
      return '';
    }
    return this.parent.virtual_identifier_suffix + '_' + this.language;
  }
}

export namespace VirtualDocument {
  /**
   * Identifier is used to aide assignment of the connection to the virtual document
   * handling specific, nested language usage; it will be appended to the file name
   * when creating a connection.
   */
  export type virtual_identifier_suffix = string;
}
