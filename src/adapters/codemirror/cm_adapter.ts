export import CodeMirror = require('codemirror');
import { until_ready } from '../../utils';
import { VirtualEditor } from '../../virtual/editor';
import { VirtualDocument } from '../../virtual/document';
import { IRootPosition } from '../../positioning';
import { ILSPFeature } from './feature';
import { IJupyterLabComponentsManager } from '../jupyterlab/jl_adapter';

export class CodeMirrorAdapter {
  protected features: Array<ILSPFeature>;

  private last_change: CodeMirror.EditorChange;
  private doc_change_handler: Function;

  constructor(
    protected editor: VirtualEditor,
    protected virtual_document: VirtualDocument,
    protected jupyterlab_components: IJupyterLabComponentsManager,
    features = new Array<ILSPFeature>()
  ) {
    // due to an unknown reason the default listener (as defined in the base class) is not invoked on file editors
    // the workaround - setting it at doc instead - works, thus the original one is first disabled (above) and a new
    // one is added (below); this however can have devastating effect on the editor synchronization - be careful!
    this.doc_change_handler = this.saveChange.bind(this);
    CodeMirror.on(this.editor.getDoc(), 'change', this.doc_change_handler);

    this.features = [];

    for (let feature of features) {
      feature.register();
      if (!feature.is_registered) {
        console.warn('The feature ', feature, 'was not registered properly');
      }
      this.features.push(feature);
    }
  }

  public async updateAfterChange() {
    this.jupyterlab_components.remove_tooltip();
    await until_ready(() => this.last_change != null, 30, 22).catch(() => {
      this.invalidateLastChange();
      throw Error(
        'No change obtained from CodeMirror editor within the expected time of 0.66s'
      );
    });
    let change: CodeMirror.EditorChange = this.last_change;

    try {
      const root_position = this.editor
        .getDoc()
        .getCursor('end') as IRootPosition;

      let document = this.editor.document_at_root_position(root_position);

      if (this.virtual_document !== document) {
        return true;
      }

      if (!change || !change.text.length || !change.text[0].length) {
        // deletion - ignore
        return true;
      }

      for (let feature of this.features) {
        feature.afterChange(change, root_position);
      }
      return true;
    } catch (e) {
      console.log('updateAfterChange failure');
      console.error(e);
    }
    this.invalidateLastChange();
  }

  public invalidateLastChange() {
    this.last_change = null;
  }

  public saveChange(doc: CodeMirror.Doc, change: CodeMirror.EditorChange) {
    this.last_change = change;
  }

  public remove() {
    for (let feature of this.features) {
      feature.remove();
    }
    CodeMirror.off(this.editor.getDoc(), 'change', this.doc_change_handler);
  }
}
