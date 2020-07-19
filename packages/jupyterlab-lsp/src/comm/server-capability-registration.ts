import { Registration, ServerCapabilities, Unregistration } from '../lsp';

interface IFlexibleServerCapabilities extends ServerCapabilities {
  [key: string]: any;
}

function registerServerCapability(
  serverCapabilities: ServerCapabilities,
  registration: Registration
): ServerCapabilities {
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
    throw new Error('Could not register server capability.');
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
