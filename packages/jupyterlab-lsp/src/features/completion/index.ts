import { ILSPCompletionThemeManager } from '@jupyter-lsp/completion-theme';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICompletionProviderManager } from '@jupyterlab/completer';
import {
  ILSPFeatureManager,
  ILSPDocumentConnectionManager
} from '@jupyterlab/lsp';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { LabIcon } from '@jupyterlab/ui-components';
import * as lsProtocol from 'vscode-languageserver-protocol';

import completionSvg from '../../../style/icons/completion.svg';
import { CodeCompletion as LSPCompletionSettings } from '../../_completion';
import { FeatureSettings, Feature } from '../../feature';
import { CompletionItemTag } from '../../lsp';
import { PLUGIN_ID } from '../../tokens';

import {
  EnhancedContextCompleterProvider,
  EnhancedKernelCompleterProvider
} from './overrides';
import { CompletionProvider } from './provider';

export const completionIcon = new LabIcon({
  name: 'lsp:completion',
  svgstr: completionSvg
});

export class CompletionFeature extends Feature {
  readonly id = CompletionFeature.id;
  readonly capabilities: lsProtocol.ClientCapabilities = {
    textDocument: {
      completion: {
        dynamicRegistration: true,
        completionItem: {
          snippetSupport: false,
          commitCharactersSupport: true,
          documentationFormat: ['markdown', 'plaintext'],
          deprecatedSupport: true,
          preselectSupport: false,
          tagSupport: {
            valueSet: [CompletionItemTag.Deprecated]
          }
        },
        contextSupport: true
      }
    }
  };

  constructor(protected options: CompletionFeature.IOptions) {
    super(options);
    this._configure();

    options.settings.changed.connect(() => {
      this._configure();
    });

    const provider = new CompletionProvider({ ...options });
    options.completionProviderManager.registerProvider(provider);
    options.completionProviderManager.registerProvider(
      new EnhancedContextCompleterProvider(options)
    );
    options.completionProviderManager.registerProvider(
      new EnhancedKernelCompleterProvider(options)
    );
  }

  private _configure() {
    const settings = this.options.settings;
    const completionThemeManager = this.options.iconsThemeManager;

    if (!settings.composite.disable) {
      document.body.dataset.lspCompleterLayout = settings.composite.layout;
      completionThemeManager.set_theme(settings.composite.theme);
      completionThemeManager.set_icons_overrides(settings.composite.typesMap);
    } else {
      completionThemeManager.set_theme(null);
      delete document.body.dataset.lspCompleterLayout;
    }
  }
}

export namespace CompletionFeature {
  export interface IOptions extends Feature.IOptions {
    settings: FeatureSettings<LSPCompletionSettings>;
    renderMimeRegistry: IRenderMimeRegistry;
    completionProviderManager: ICompletionProviderManager;
    iconsThemeManager: ILSPCompletionThemeManager;
  }
  export const id = PLUGIN_ID + ':completion';
}

export const COMPLETION_PLUGIN: JupyterFrontEndPlugin<void> = {
  id: CompletionFeature.id,
  requires: [
    ILSPFeatureManager,
    ISettingRegistry,
    ICompletionProviderManager,
    ILSPCompletionThemeManager,
    IRenderMimeRegistry,
    ILSPDocumentConnectionManager
  ],
  autoStart: true,
  activate: async (
    app: JupyterFrontEnd,
    featureManager: ILSPFeatureManager,
    settingRegistry: ISettingRegistry,
    completionProviderManager: ICompletionProviderManager,
    iconsThemeManager: ILSPCompletionThemeManager,
    renderMimeRegistry: IRenderMimeRegistry,
    connectionManager: ILSPDocumentConnectionManager
  ) => {
    const settings = new FeatureSettings<LSPCompletionSettings>(
      settingRegistry,
      CompletionFeature.id
    );
    await settings.ready;
    if (settings.composite.disable) {
      return;
    }
    const feature = new CompletionFeature({
      settings,
      connectionManager,
      renderMimeRegistry,
      iconsThemeManager,
      completionProviderManager
    });

    featureManager.register(feature);
  }
};
