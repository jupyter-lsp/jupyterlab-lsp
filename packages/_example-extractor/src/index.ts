import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  ILSPCodeExtractorsManager,
  RegExpForeignCodeExtractor
} from '@krassowski/jupyterlab-lsp';

const NS = '@krassowski/jupyterlab-lsp-example-extractor';

export const extractor = new RegExpForeignCodeExtractor({
  language: 'foo',
  pattern: '^%%(foo)( .*?)?\n([^]*)',
  foreign_capture_groups: [3],
  is_standalone: true,
  file_extension: 'foo'
});

const plugin: JupyterFrontEndPlugin<void> = {
  id: `${NS}:PLUGIN`,
  requires: [ILSPCodeExtractorsManager],
  activate: (_app: JupyterFrontEnd, extractors: ILSPCodeExtractorsManager) => {
    extractors.register(extractor, 'python');
  }
};

export default plugin;
