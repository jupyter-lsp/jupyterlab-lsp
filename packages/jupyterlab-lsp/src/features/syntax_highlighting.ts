import { EditorView } from '@codemirror/view';
import type { ViewUpdate } from '@codemirror/view';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  IEditorMimeTypeService,
  IEditorServices
} from '@jupyterlab/codeeditor';
import {
  CodeMirrorEditor,
  IEditorExtensionRegistry,
  IEditorLanguageRegistry,
  EditorExtensionRegistry
} from '@jupyterlab/codemirror';
import {
  ILSPFeatureManager,
  ILSPDocumentConnectionManager,
  WidgetLSPAdapter,
  Document
} from '@jupyterlab/lsp';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { LabIcon } from '@jupyterlab/ui-components';

import syntaxSvg from '../../style/icons/syntax-highlight.svg';
import { CodeSyntax as LSPSyntaxHighlightingSettings } from '../_syntax_highlighting';
import { ContextAssembler } from '../context';
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
    const contextAssembler = options.contextAssembler;

    options.editorExtensionRegistry.addExtension({
      name: 'lsp:syntaxHighlighting',
      factory: options => {
        let intialized = false;

        const updateHandler = async (
          viewUpdate: ViewUpdate,
          awaitUpdate = true
        ) => {
          const adapter = [...connectionManager.adapters.values()].find(
            adapter => adapter.widget.node.contains(viewUpdate.view.contentDOM)
          );

          // TODO https://github.com/jupyterlab/jupyterlab/issues/14711#issuecomment-1624442627
          // const editor = adapter.editors.find(e => e.model === options.model);

          if (adapter) {
            await adapter.ready;
            const accessorFromNode = contextAssembler.editorFromNode(
              adapter,
              viewUpdate.view.contentDOM
            );
            if (!accessorFromNode) {
              console.warn(
                'Editor accessor not found from node, falling back to activeEditor'
              );
            }
            const editorAccessor = accessorFromNode
              ? accessorFromNode
              : adapter.activeEditor;

            if (!editorAccessor) {
              console.warn('No accessor');
              return;
            }
            await this.updateMode(
              adapter,
              viewUpdate.view,
              editorAccessor,
              awaitUpdate
            );
          }
        };

        const updateListener = EditorView.updateListener.of(
          async viewUpdate => {
            if (!viewUpdate.docChanged) {
              if (intialized) {
                return;
              }
              // TODO: replace this with a simple Promise.all([editorAccessor.ready, adapter.ready]).then(() => updateMode(options.editor))
              // once JupyterLab 4.1 with improved factory API is out.
              // For now we wait 2.5 seconds hoping the adapter will be connected
              // and the document will be ready
              setTimeout(async () => {
                await updateHandler(viewUpdate, false);
              }, 2500);
              intialized = true;
            }

            await updateHandler(viewUpdate);
          }
        );

        // update the mode at first update even if no changes to ensure the
        // correct mode gets applied on load.

        return EditorExtensionRegistry.createImmutableExtension([
          updateListener
        ]);
      }
    });
  }

  private getMode(language: string): string | undefined {
    const mimetype = this.options.mimeTypeService.getMimeTypeByLanguage({
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

  async updateMode(
    adapter: WidgetLSPAdapter<any>,
    view: EditorView,
    editorAccessor: Document.IEditor,
    awaitUpdate = true
  ) {
    const topDocument = adapter.virtualDocument as VirtualDocument;

    if (!topDocument) {
      return;
    }
    if (awaitUpdate) {
      await topDocument.updateManager.updateDone;
    }

    const editor = editorAccessor.getEditor()! as CodeMirrorEditor;
    const totalArea = editor.state.doc.length;

    const overrides = new Map();
    for (const map of topDocument.getForeignDocuments(editorAccessor)) {
      for (const [range, block] of map.entries()) {
        const blockEditor = block.editor.getEditor()! as CodeMirrorEditor;
        if (blockEditor != editor) {
          continue;
        }
        const coveredArea =
          editor.getOffsetAt(range.end) - editor.getOffsetAt(range.start);
        const coverage = coveredArea / totalArea;

        const language = block.virtualDocument.language;
        const mode = this.getMode(language);

        // if not highlighting mode available, skip this editor
        if (typeof mode === 'undefined') {
          continue;
        }

        // change the mode if the majority of the code is the foreign code
        if (coverage > this.options.settings.composite.foreignCodeThreshold) {
          const original = editor.model.mimeType;
          // this will trigger a side effect of switching language by updating
          // private language compartment (implementation detail).
          editor.model.mimeType = mode;
          overrides.set(editor, original);
        }
      }
    }
    // restore mode on the editor if it no longer over the threshold
    // (but only those which belong to this adapter).
    if (!overrides.has(editor)) {
      const originalMode = this.originalModes.get(editor);
      if (originalMode) {
        editor.model.mimeType = originalMode;
      }
    }
    // add new overrides to remember the original mode
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
    contextAssembler: ContextAssembler;
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
    IEditorLanguageRegistry,
    ILSPDocumentConnectionManager
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
    if (settings.composite.disable) {
      return;
    }
    const contextAssembler = new ContextAssembler({
      app,
      connectionManager
    });
    const feature = new SyntaxHighlightingFeature({
      settings,
      connectionManager,
      editorExtensionRegistry,
      mimeTypeService: editorServices.mimeTypeService,
      languageRegistry,
      contextAssembler
    });
    featureManager.register(feature);
    // return feature;
  }
};
