import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

const NS = '@krassowski/jupyterlab-lsp-klingon-integration';

const plugin: JupyterFrontEndPlugin<void> = {
  id: `${NS}:PLUGIN`,
  activate: (app: JupyterFrontEnd) => {
    // this will have a language server specification
    // but the language server will NOT be installed
    app.docRegistry.addFileType({
      name: 'klingon',
      mimeTypes: ['text/klingon'],
      extensions: ['.klingon'],
      displayName: 'Klingon',
      contentType: 'file',
      fileFormat: 'text'
    });
    // this will NOT have a language server specification
    app.docRegistry.addFileType({
      name: 'ancient-klingon',
      mimeTypes: ['text/ancient-klingon'],
      extensions: ['.ancient_klingon'],
      displayName: 'Ancient Klingon',
      contentType: 'file',
      fileFormat: 'text'
    });
  },
  autoStart: true
};

export default plugin;
