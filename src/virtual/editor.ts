import { VirtualDocument } from './document';
import { IOverridesRegistry } from '../magics/overrides';
import { IForeignCodeExtractorsRegistry } from '../extractors/types';
import { CodeMirror } from '../adapters/codemirror';
import {
  IEditorPosition,
  IRootPosition,
  ISourcePosition,
  IVirtualPosition
} from '../positioning';

/**
 * VirtualEditor extends the CodeMirror.Editor interface; its subclasses may either
 * fast-forward any requests to an existing instance of the CodeMirror.Editor
 * (using ES6 Proxy), or implement custom behaviour, allowing for the use of
 * virtual documents representing code in complex entities such as notebooks.
 */
export abstract class VirtualEditor implements CodeMirror.Editor {
  virtual_document: VirtualDocument;
  overrides_registry: IOverridesRegistry;
  code_extractors: IForeignCodeExtractorsRegistry;

  public constructor(
    language: string,
    path: string,
    overrides_registry: IOverridesRegistry,
    foreign_code_extractors: IForeignCodeExtractorsRegistry
  ) {
    this.virtual_document = new VirtualDocument(
      language,
      path,
      overrides_registry,
      foreign_code_extractors,
      false
    );
  }

  abstract get_editor_index(position: IVirtualPosition): number;

  abstract transform_virtual_to_source(
    position: CodeMirror.Position
  ): CodeMirror.Position;

  abstract transform_editor_to_root(
    cm_editor: CodeMirror.Editor,
    position: IEditorPosition
  ): IRootPosition;

  abstract get_cm_editor(position: IRootPosition): CodeMirror.Editor;

  abstract addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject
  ): void;

  // TODO .root is not really needed as we are in editor now...
  // TODO remove this function
  get_virtual_document(
    position: IRootPosition
  ): { document: VirtualDocument; virtual_position: IVirtualPosition } {
    return {
      document: this.document_as_root_position(position),
      virtual_position: this.root_position_to_virtual_position(position)
    };
  }

  document_as_root_position(position: IRootPosition): VirtualDocument {
    let root_as_source = position as ISourcePosition;
    return this.virtual_document.root.document_at_source_position(
      root_as_source
    );
  }

  root_position_to_virtual_position(position: IRootPosition): IVirtualPosition {
    let root_as_source = position as ISourcePosition;
    return this.virtual_document.root.virtual_position_at_document(
      root_as_source
    );
  }

  get_editor_at_root_position(root_position: IRootPosition) {
    return this.virtual_document.root.get_editor_at_source_line(root_position);
  }

  transform_root_position_to_editor_position(
    root_position: IRootPosition
  ): IEditorPosition {
    return this.virtual_document.root.transform_source_to_editor(root_position);
  }
}

// tslint:disable-next-line:interface-name
export interface VirtualEditor extends CodeMirror.Editor {}
