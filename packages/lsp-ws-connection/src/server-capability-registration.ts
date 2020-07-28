import {
  Registration,
  ServerCapabilities,
  Unregistration
} from 'vscode-languageserver-protocol';

interface IFlexibleServerCapabilities extends ServerCapabilities {
  [key: string]: any;
}

function registerServerCapability(
  serverCapabilities: ServerCapabilities,
  registration: Registration
): ServerCapabilities | null {
  const serverCapabilitiesCopy = JSON.parse(
    JSON.stringify(serverCapabilities)
  ) as IFlexibleServerCapabilities;
  const { method, registerOptions } = registration;
  const providerName = method.substring(13) + 'Provider';

  if (providerName) {
    if (!registerOptions) {
      serverCapabilitiesCopy[providerName] = true;
    } else {
      serverCapabilitiesCopy[providerName] = JSON.parse(
        JSON.stringify(registerOptions)
      );
    }
  } else {
    console.warn('Could not register server capability.', registration);
    return null;
  }

  return serverCapabilitiesCopy;
}

function unregisterServerCapability(
  serverCapabilities: ServerCapabilities,
  unregistration: Unregistration
): ServerCapabilities {
  const serverCapabilitiesCopy = JSON.parse(
    JSON.stringify(serverCapabilities)
  ) as IFlexibleServerCapabilities;
  const { method } = unregistration;
  const providerName = method.substring(13) + 'Provider';

  delete serverCapabilitiesCopy[providerName];

  return serverCapabilitiesCopy;
}

export { registerServerCapability, unregisterServerCapability };
