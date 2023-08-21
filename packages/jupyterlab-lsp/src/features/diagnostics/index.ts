import { INotebookShell } from '@jupyter-notebook/application';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  ILabShell
} from '@jupyterlab/application';
import { ICommandPalette, IThemeManager } from '@jupyterlab/apputils';
import { IEditorExtensionRegistry } from '@jupyterlab/codemirror';
import {
  ILSPFeatureManager,
  ILSPDocumentConnectionManager
} from '@jupyterlab/lsp';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';

import { CodeDiagnostics as LSPDiagnosticsSettings } from '../../_diagnostics';
import { ContextAssembler } from '../../context';
import { FeatureSettings } from '../../feature';

import { diagnosticsIcon, diagnosticsPanel } from './diagnostics';
import { DiagnosticsFeature } from './feature';
import { IDiagnosticsFeature } from './tokens';

export namespace CommandIDs {
  export const showPanel = 'lsp:show-diagnostics-panel';
}

export const DIAGNOSTICS_PLUGIN: JupyterFrontEndPlugin<IDiagnosticsFeature> = {
  id: DiagnosticsFeature.id,
  requires: [
    ILSPFeatureManager,
    ISettingRegistry,
    ILSPDocumentConnectionManager,
    IEditorExtensionRegistry
  ],
  optional: [IThemeManager, ICommandPalette, ITranslator],
  autoStart: true,
  activate: async (
    app: JupyterFrontEnd,
    featureManager: ILSPFeatureManager,
    settingRegistry: ISettingRegistry,
    connectionManager: ILSPDocumentConnectionManager,
    editorExtensionRegistry: IEditorExtensionRegistry,
    themeManager: IThemeManager | null,
    palette: ICommandPalette | null,
    translator: ITranslator | null
  ) => {
    const trans = (translator || nullTranslator).load('jupyterlab_lsp');
    const settings = new FeatureSettings<LSPDiagnosticsSettings>(
      settingRegistry,
      DiagnosticsFeature.id
    );
    await settings.ready;
    const feature = new DiagnosticsFeature({
      settings,
      connectionManager,
      shell: app.shell as ILabShell | INotebookShell,
      editorExtensionRegistry,
      themeManager,
      trans
    });
    featureManager.register(feature);

    const assembler = new ContextAssembler({
      app,
      connectionManager
    });

    app.commands.addCommand(CommandIDs.showPanel, {
      execute: async () => {
        const context = assembler.getContext();
        if (!context) {
          console.warn('Could not get context');
          return;
        }
        feature.switchDiagnosticsPanelSource(context.adapter);

        if (!diagnosticsPanel.is_registered) {
          diagnosticsPanel.trans = trans;
          diagnosticsPanel.register(app);
        }

        const panel_widget = diagnosticsPanel.widget;
        if (!panel_widget.isAttached) {
          app.shell.add(panel_widget, 'main', {
            ref: context.adapter.widgetId,
            mode: 'split-bottom'
          });
        }
        app.shell.activateById(panel_widget.id);
      },
      label: trans.__('Show diagnostics panel'),
      icon: diagnosticsIcon,
      isEnabled: () => {
        // TODO notebook
        return app.name != 'JupyterLab Classic';
      }
    });

    // add to menus
    app.contextMenu.addItem({
      selector: '.jp-Notebook .jp-CodeCell .jp-Editor',
      command: CommandIDs.showPanel,
      rank: 10
    });

    app.contextMenu.addItem({
      selector: '.jp-FileEditor',
      command: CommandIDs.showPanel,
      rank: 0
    });

    if (palette) {
      palette.addItem({
        command: CommandIDs.showPanel,
        category: trans.__('Language Server Protocol')
      });
    }
    return feature;
  }
};
