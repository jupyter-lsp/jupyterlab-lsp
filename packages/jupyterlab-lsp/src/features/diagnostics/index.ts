import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { ILSPFeatureManager, ILSPDocumentConnectionManager } from '@jupyterlab/lsp';

import { ContextAssembler } from '../../command_manager';
import { ILSPDocumentConnectionManager as ILSPDocumentConnectionManagerDownstream } from '../../connection_manager'
import { DiagnosticsFeature } from './feature';


import {
  diagnosticsIcon,
  diagnosticsPanel
} from './diagnostics';



export namespace CommandIDs {
  export const showPanel = 'lsp:show-diagnostics-panel';
}

export const DIAGNOSTICS_PLUGIN: JupyterFrontEndPlugin<void> = {
  id: DiagnosticsFeature.id,
  requires: [ILSPFeatureManager, ISettingRegistry, ILSPDocumentConnectionManager],
  optional: [ITranslator],
  autoStart: true,
  activate: (
    app: JupyterFrontEnd,
    featureManager: ILSPFeatureManager,
    settingRegistry: ISettingRegistry,
    connectionManager: ILSPDocumentConnectionManagerDownstream,
    translator: ITranslator
  ) => {
    const feature = new DiagnosticsFeature({
      settingRegistry,
      connectionManager,
      //renderMimeRegistry,
      //editorExtensionRegistry
    });
    featureManager.register(feature);

    const trans = (translator || nullTranslator).load('jupyterlab_lsp');

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
        feature.switchDiagnosticsPanelSource();

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
  }
};
