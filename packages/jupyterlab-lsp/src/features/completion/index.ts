import { ILSPCompletionThemeManager } from '@jupyter-lsp/completion-theme';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  ILSPFeatureManager,
  ILSPDocumentConnectionManager
} from '@jupyterlab/lsp';
import { ICompletionProviderManager } from '@jupyterlab/completer';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import * as lsProtocol from 'vscode-languageserver-protocol';
import { LabIcon } from '@jupyterlab/ui-components';

import completionSvg from '../../../style/icons/completion.svg';
import { CodeCompletion as LSPCompletionSettings } from '../../_completion';
import { FeatureSettings, Feature } from '../../feature';
import { ILSPDocumentConnectionManager as ILSPDocumentConnectionManagerDownstream } from '../../connection_manager';
import { CompletionItemTag } from '../../lsp';
import { PLUGIN_ID } from '../../tokens';
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
        contextSupport: false
      }
    }
  };
  protected settings: FeatureSettings<LSPCompletionSettings>;

  constructor(options: CompletionFeature.IOptions) {
    super(options);
    this.settings = options.settings;
    const provider = new CompletionProvider({ ...options });
    options.completionProviderManager.registerProvider(provider);
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
    connectionManager: ILSPDocumentConnectionManagerDownstream
  ) => {
    const settings = new FeatureSettings<LSPCompletionSettings>(
      settingRegistry,
      CompletionFeature.id
    );
    await settings.ready;
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
