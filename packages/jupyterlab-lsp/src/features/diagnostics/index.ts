import { INotebookShell, NotebookApp } from '@jupyter-notebook/application';
import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  ILabShell
} from '@jupyterlab/application';
import {
  ICommandPalette,
  IThemeManager,
  MainAreaWidget,
  WidgetTracker
} from '@jupyterlab/apputils';
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
import { DiagnosticsListing } from './listing';
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
  optional: [ILayoutRestorer, IThemeManager, ICommandPalette, ITranslator],
  autoStart: true,
  activate: async (
    app: JupyterFrontEnd,
    featureManager: ILSPFeatureManager,
    settingRegistry: ISettingRegistry,
    connectionManager: ILSPDocumentConnectionManager,
    editorExtensionRegistry: IEditorExtensionRegistry,
    restorer: ILayoutRestorer | null,
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
    if (!settings.composite.disable) {
      featureManager.register(feature);

      const assembler = new ContextAssembler({
        app,
        connectionManager
      });

      const namespace = 'lsp-diagnostics';
      const tracker = new WidgetTracker<MainAreaWidget<DiagnosticsListing>>({
        namespace: namespace
      });

      app.commands.addCommand(CommandIDs.showPanel, {
        execute: async () => {
          const context = assembler.getContext();
          let ref = null;
          if (context) {
            feature.switchDiagnosticsPanelSource(context.adapter);
            ref = context.adapter.widgetId;
          } else {
            console.warn('Could not get context');
          }

          if (!diagnosticsPanel.isRegistered) {
            diagnosticsPanel.trans = trans;
            diagnosticsPanel.register(app);
          }

          const panelWidget = diagnosticsPanel.widget;
          if (!panelWidget.isAttached) {
            void tracker.add(panelWidget);
            if (
              typeof NotebookApp !== 'undefined' &&
              app instanceof NotebookApp
            ) {
              app.shell.add(panelWidget, 'right');
              await app.commands.execute('application:toggle-panel', {
                id: panelWidget.id,
                side: 'right'
              });
            } else {
              app.shell.add(panelWidget, 'main', {
                ref: ref,
                mode: 'split-bottom'
              });
            }
          }
          app.shell.activateById(panelWidget.id);
          void tracker.save(panelWidget);
        },
        label: trans.__('Show diagnostics panel'),
        icon: diagnosticsIcon
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

      if (restorer) {
        void restorer.restore(tracker, {
          command: CommandIDs.showPanel,
          name: _ => 'listing'
        });
      }
    }
    return feature;
  }
};
