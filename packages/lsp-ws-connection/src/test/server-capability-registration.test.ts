import { expect } from 'chai';
import {
  Registration,
  ServerCapabilities,
  Unregistration
} from 'vscode-languageserver-protocol';

import {
  registerServerCapability,
  unregisterServerCapability
} from '../server-capability-registration';

describe('ServerCapabilities client registration', () => {
  const serverCapabilities = {
    hoverProvider: true,
    completionProvider: {
      resolveProvider: true,
      triggerCharacters: ['.', ',']
    },
    signatureHelpProvider: {
      triggerCharacters: ['.', ',']
    },
    definitionProvider: true,
    typeDefinitionProvider: true,
    implementationProvider: true,
    referencesProvider: true,
    documentHighlightProvider: true,
    documentSymbolProvider: true,
    workspaceSymbolProvider: true,
    codeActionProvider: true,
    codeLensProvider: {
      resolveProvider: true
    },
    documentFormattingProvider: true,
    documentRangeFormattingProvider: true,
    documentOnTypeFormattingProvider: {
      firstTriggerCharacter: '.'
    },
    renameProvider: true,
    documentLinkProvider: {
      resolveProvider: true
    },
    colorProvider: true,
    foldingRangeProvider: true,
    declarationProvider: true,
    executeCommandProvider: {
      commands: ['not', 'real', 'commands']
    }
  };

  it('registers server capabilities', () => {
    Object.keys(serverCapabilities).forEach(capability => {
      const capabilityOptions = (serverCapabilities as any)[capability];
      const registration = {
        id: 'id',
        method: getMethodFromCapability(capability)
      } as Registration;

      if (typeof capabilityOptions !== 'boolean') {
        registration.registerOptions = capabilityOptions;
      }

      const newServerCapabilities = registerServerCapability(
        {} as ServerCapabilities,
        registration
      );

      if (typeof capabilityOptions === 'boolean') {
        // eslint-disable-next-line jest/no-conditional-expect
        expect((newServerCapabilities as any)[capability]).equal(
          capabilityOptions
        );
      } else {
        // eslint-disable-next-line jest/no-conditional-expect
        expect((newServerCapabilities as any)[capability]).to.deep.equal(
          capabilityOptions
        );
      }
    });
  });

  it('unregisters server capabilities', () => {
    Object.keys(serverCapabilities).forEach(capability => {
      const unregistration = {
        id: 'some id',
        method: getMethodFromCapability(capability)
      } as Unregistration;
      const newServerCapabilities = unregisterServerCapability(
        serverCapabilities,
        unregistration
      );

      expect((newServerCapabilities as any)[capability]).equal(void 0);
    });
  });
});

function getMethodFromCapability(capability: string): string {
  return `textDocument/${capability.split('Provider')[0]}`;
}
