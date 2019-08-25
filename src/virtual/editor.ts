import { VirtualDocument } from './document';
import { IOverridesRegistry } from '../magics/overrides';
import { IForeignCodeExtractorsRegistry } from '../extractors/types';
import CodeMirror = require('codemirror');


export abstract class VirtualEditor implements CodeMirror.Editor {
  virtual_document: VirtualDocument;
  overrides_registry: IOverridesRegistry;
  code_extractors: IForeignCodeExtractorsRegistry;

  protected constructor(
    language: string,
    overrides_registry: IOverridesRegistry,
    foreign_code_extractors: IForeignCodeExtractorsRegistry
  ) {
    this.virtual_document = new VirtualDocument(
      language,
      overrides_registry,
      foreign_code_extractors
    );
  }

  abstract get_editor_index(position: CodeMirror.Position): number;

  abstract get get_cell_id(): (position: CodeMirror.Position) => string;

  abstract get transform(): (
    position: CodeMirror.Position
  ) => CodeMirror.Position;

  abstract get_cm_editor(position: CodeMirror.Position): CodeMirror.Editor;
}

// tslint:disable-next-line:interface-name
export interface VirtualEditor extends CodeMirror.Editor {}
