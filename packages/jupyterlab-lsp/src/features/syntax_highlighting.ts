import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  IEditorMimeTypeService,
  IEditorServices
} from '@jupyterlab/codeeditor';
import { CodeMirrorEditor, ICodeMirror } from '@jupyterlab/codemirror';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator } from '@jupyterlab/translation';
import { LabIcon } from '@jupyterlab/ui-components';

import syntaxSvg from '../../style/icons/syntax-highlight.svg';
import { CodeSyntax as LSPSyntaxHighlightingSettings } from '../_syntax_highlighting';
import { CodeMirrorIntegration } from '../editor_integration/codemirror';
import {
  FeatureSettings,
  IEditorIntegrationOptions,
  IFeatureLabIntegration,
  IFeatureSettings
} from '../feature';
import { ILSPFeatureManager, PLUGIN_ID } from '../tokens';

export const syntaxHighlightingIcon = new LabIcon({
  name: 'lsp:syntax-highlighting',
  svgstr: syntaxSvg
});

const FEATURE_ID = PLUGIN_ID + ':syntax_highlighting';

export class CMSyntaxHighlighting extends CodeMirrorIntegration {
  editors_with_active_highlight: Set<CodeMirrorEditor>;

  constructor(options: IEditorIntegrationOptions) {
    super(options);
    this.virtualDocument.changed.connect(this.update_mode.bind(this), this);
    this.editors_with_active_highlight = new Set();
  }

  get lab_integration() {
    return super.lab_integration as SyntaxLabIntegration;
  }

  get settings() {
    return super.settings as IFeatureSettings<LSPSyntaxHighlightingSettings>;
  }

  private get_mode(language: string) {
    let mimetype = this.lab_integration.mimeTypeService.getMimeTypeByLanguage({
      name: language
    });

    if (!mimetype || mimetype == 'text/plain') {
      // if a mimetype cannot be found it will be 'text/plain', therefore do
      // not change mode to text/plain, as this could be a step backwards for
      // the user experience
      return;
    }

    return this.lab_integration.codeMirror.CodeMirror.findModeByMIME(mimetype);
  }

  update_mode() {
    let root = this.virtualDocument;
    let editors_with_current_highlight = new Set<CodeMirrorEditor>();

    for (let map of root.foreignDocument_maps) {
      for (let [range, block] of map.entries()) {
        let ceEditor = block.editor as CodeMirrorEditor;
        let editor = ceEditor.editor;
        let lines = editor.getValue('\n');
        let total_area = lines.concat('').length;

        let covered_area =
          ceEditor.getOffsetAt(range.end) - ceEditor.getOffsetAt(range.start);

        let coverage = covered_area / total_area;

        let language = block.virtualDocument.language;

        let mode = this.get_mode(language);

        // if not highlighting mode available, skip this editor
        if (typeof mode === 'undefined') {
          continue;
        }

        // change the mode if the majority of the code is the foreign code
        if (coverage > this.settings.composite.foreignCodeThreshold) {
          editors_with_current_highlight.add(ceEditor);
          let old_mode = editor.getOption('mode');
          if (old_mode != mode.mime) {
            editor.setOption('mode', mode.mime);
          }
        }
      }
    }

    if (editors_with_current_highlight != this.editors_with_active_highlight) {
      for (let ceEditor of this.editors_with_active_highlight) {
        if (!editors_with_current_highlight.has(ceEditor)) {
          // ceEditor.injectExtension ?
          ceEditor.editor.setOption('mode', ceEditor.model.mimeType);
        }
      }
    }

    this.editors_with_active_highlight = editors_with_current_highlight;
  }
}

class SyntaxLabIntegration implements IFeatureLabIntegration {
  // TODO: we could accept custom mimetype mapping from settings
  settings: IFeatureSettings<LSPSyntaxHighlightingSettings>;

  constructor(
    public mimeTypeService: IEditorMimeTypeService,
    public codeMirror: ICodeMirror
  ) {}
}

export const SYNTAX_HIGHLIGHTING_PLUGIN: JupyterFrontEndPlugin<void> = {
  id: FEATURE_ID,
  requires: [
    ILSPFeatureManager,
    IEditorServices,
    ISettingRegistry,
    ICodeMirror,
    ITranslator
  ],
  autoStart: true,
  activate: (
    app: JupyterFrontEnd,
    featureManager: ILSPFeatureManager,
    editorServices: IEditorServices,
    settingRegistry: ISettingRegistry,
    codeMirror: ICodeMirror,
    translator: ITranslator
  ) => {
    const settings = new FeatureSettings(settingRegistry, FEATURE_ID);
    const trans = translator.load('jupyterlab_lsp');

    featureManager.register({
      feature: {
        editorIntegrationFactory: new Map([
          ['CodeMirrorEditor', CMSyntaxHighlighting]
        ]),
        commands: [],
        id: FEATURE_ID,
        name: trans.__('Syntax highlighting'),
        labIntegration: new SyntaxLabIntegration(
          editorServices.mimeTypeService,
          codeMirror
        ),
        settings: settings
      }
    });
  }
};
