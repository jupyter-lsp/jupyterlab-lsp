import { RegExpForeignCodeExtractor } from '@jupyter-lsp/jupyterlab-lsp';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ILSPCodeExtractorsManager } from '@jupyterlab/lsp';

const NS = '@jupyter-lsp/jupyterlab-lsp-example-extractor';

export const extractor = new RegExpForeignCodeExtractor({
  language: 'foo',
  pattern: '^%%(foo)( .*?)?\n([^]*)',
  foreignCaptureGroups: [3],
  isStandalone: true,
  fileExtension: 'foo'
});

const plugin: JupyterFrontEndPlugin<void> = {
  id: `${NS}:PLUGIN`,
  requires: [ILSPCodeExtractorsManager],
  activate: (_app: JupyterFrontEnd, extractors: ILSPCodeExtractorsManager) => {
    extractors.register(extractor, 'python');
  }
};

export default plugin;
