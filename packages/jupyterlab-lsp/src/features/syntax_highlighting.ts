import { EditorView } from '@codemirror/view';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  IEditorMimeTypeService,
  IEditorServices
} from '@jupyterlab/codeeditor';
import { CodeMirrorEditor ,
  IEditorExtensionRegistry,
  IEditorLanguageRegistry,
  EditorExtensionRegistry
} from '@jupyterlab/codemirror';
import {
  ILSPFeatureManager,
  ILSPDocumentConnectionManager,
  WidgetLSPAdapter
} from '@jupyterlab/lsp';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { LabIcon } from '@jupyterlab/ui-components';

import syntaxSvg from '../../style/icons/syntax-highlight.svg';
import { CodeSyntax as LSPSyntaxHighlightingSettings } from '../_syntax_highlighting';
import { FeatureSettings, Feature } from '../feature';
import { PLUGIN_ID } from '../tokens';
import { VirtualDocument } from '../virtual/document';

export const syntaxHighlightingIcon = new LabIcon({
  name: 'lsp:syntax-highlighting',
  svgstr: syntaxSvg
});

export class SyntaxHighlightingFeature extends Feature {
  readonly id = SyntaxHighlightingFeature.id;
  // note: semantic highlighting could be implemented here
  readonly capabilities = {};
  protected originalModes = new Map<CodeMirrorEditor, string>();

  constructor(protected options: SyntaxHighlightingFeature.IOptions) {
    super(options);
    const connectionManager = options.connectionManager;

    options.editorExtensionRegistry.addExtension({
      name: 'lsp:codeSignature',
      factory: options => {
        const updateListener = EditorView.updateListener.of(viewUpdate => {
          if (!viewUpdate.docChanged) {
            return;
          }

          const adapter = [...connectionManager.adapters.values()].find(
            adapter => adapter.widget.node.contains(viewUpdate.view.contentDOM)
          );

          // TODO https://github.com/jupyterlab/jupyterlab/issues/14711#issuecomment-1624442627
          // const editor = adapter.editors.find(e => e.model === options.model);

          if (adapter) {
            this.update_mode(adapter, viewUpdate.view);
          }
        });

        return EditorExtensionRegistry.createImmutableExtension([
          updateListener
        ]);
      }
    });
  }

  private getMode(language: string): string | undefined {
    let mimetype = this.options.mimeTypeService.getMimeTypeByLanguage({
      name: language
    });

    if (!mimetype || mimetype == 'text/plain') {
      // if a mimetype cannot be found it will be 'text/plain', therefore do
      // not change mode to text/plain, as this could be a step backwards for
      // the user experience
      return;
    }

    const editorLanguage = this.options.languageRegistry.findByMIME(mimetype);

    if (!editorLanguage) {
      return;
    }

    return mimetype;
  }

  update_mode(adapter: WidgetLSPAdapter<any>, view: EditorView) {
    let topDocument = adapter.virtualDocument as VirtualDocument;
    const totalArea = view.state.doc.length;

    // TODO no way to map from EditorView to Document.IEditor is blocking here.
    // TODO: active editor is not necessairly the editor that triggered the update
    const editorAccessor = adapter.activeEditor;
    const editor = editorAccessor?.getEditor()!;
    if (
      !editorAccessor ||
      !editor ||
      (editor as CodeMirrorEditor).editor !== view
    ) {
      // TODO: ideally we would not have to do this (we would have view -> editor map)
      return;
    }
    if (!topDocument) {
      return;
    }

    const overrides = new Map();
    for (let map of topDocument.getForeignDocuments(editorAccessor)) {
      for (let [range, block] of map.entries()) {
        let editor = block.editor.getEditor()! as CodeMirrorEditor;
        let covered_area =
          editor.getOffsetAt(range.end) - editor.getOffsetAt(range.start);
        let coverage = covered_area / totalArea;

        let language = block.virtualDocument.language;
        let mode = this.getMode(language);

        // if not highlighting mode available, skip this editor
        if (typeof mode === 'undefined') {
          continue;
        }

        // change the mode if the majority of the code is the foreign code
        if (coverage > this.options.settings.composite.foreignCodeThreshold) {
          // this will trigger a side effect of switching language by updating
          // private language compartment (implementation detail).
          editor.model.mimeType = mode;
          overrides.set(editor, editor.model.mimeType);
        }
      }
    }
    const relevantEditors = new Set(
      adapter.editors.map(e => e.ceEditor.getEditor())
    );
    // restore modes on editors which are no longer over the threshold
    // (but only those which belong to this adapter).
    for (const [editor, originalMode] of this.originalModes) {
      if (!relevantEditors.has(editor)) {
        continue;
      }
      if (overrides.has(editor)) {
        continue;
      } else {
        editor.model.mimeType = originalMode;
      }
    }
    // add new ovverrides to remember the original mode
    for (const [editor, mode] of overrides) {
      if (!this.originalModes.has(editor)) {
        this.originalModes.set(editor, mode);
      }
    }
  }
}

export namespace SyntaxHighlightingFeature {
  export interface IOptions extends Feature.IOptions {
    settings: FeatureSettings<LSPSyntaxHighlightingSettings>;
    mimeTypeService: IEditorMimeTypeService;
    editorExtensionRegistry: IEditorExtensionRegistry;
    languageRegistry: IEditorLanguageRegistry;
  }
  export const id = PLUGIN_ID + ':syntax_highlighting';
}

export const SYNTAX_HIGHLIGHTING_PLUGIN: JupyterFrontEndPlugin<void> = {
  id: SyntaxHighlightingFeature.id,
  requires: [
    ILSPFeatureManager,
    IEditorServices,
    ISettingRegistry,
    IEditorExtensionRegistry,
    IEditorLanguageRegistry
  ],
  autoStart: true,
  activate: async (
    app: JupyterFrontEnd,
    featureManager: ILSPFeatureManager,
    editorServices: IEditorServices,
    settingRegistry: ISettingRegistry,
    editorExtensionRegistry: IEditorExtensionRegistry,
    languageRegistry: IEditorLanguageRegistry,
    connectionManager: ILSPDocumentConnectionManager
  ) => {
    const settings = new FeatureSettings<LSPSyntaxHighlightingSettings>(
      settingRegistry,
      SyntaxHighlightingFeature.id
    );
    await settings.ready;
    const feature = new SyntaxHighlightingFeature({
      settings,
      connectionManager,
      editorExtensionRegistry,
      mimeTypeService: editorServices.mimeTypeService,
      languageRegistry
    });
    featureManager.register(feature);
    // return feature;
  }
};
