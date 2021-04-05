import * as sinon from 'sinon';

import { ILspConnection } from '..';

interface IListeners {
  [key: string]: Array<(arg: any) => void>;
}

// There is a library that can be used to mock WebSockets, but the API surface tested here is small
// enough that it is not necessary to use the library. This mock is a simple EventEmitter
export class MockConnection implements ILspConnection {
  public listeners: IListeners = {};

  /**
   * Sends a synthetic event to the client code, for example to imitate a server response
   */
  public dispatchEvent = (event: MessageEvent) => {
    const listeners = this.listeners[event.type];
    if (!listeners) {
      return false;
    }
    listeners.forEach(listener => listener.call(null, event.data));
  };

  public sendInitialize = sinon.stub();
  public sendChange = sinon.stub();
  public sendOpen = sinon.stub();
  public getHoverTooltip = sinon.stub();
  public getCompletion = sinon.stub();
  public getDetailedCompletion = sinon.stub();
  public getSignatureHelp = sinon.stub();
  public getDocumentHighlights = sinon.stub();
  public getDefinition = sinon.stub();
  public getTypeDefinition = sinon.stub();
  public getImplementation = sinon.stub();
  public getReferences = sinon.stub();
  public getDocumentUri = sinon.stub();
  public isDefinitionSupported = sinon.stub();
  public isTypeDefinitionSupported = sinon.stub();
  public isImplementationSupported = sinon.stub();
  public isReferencesSupported = sinon.stub();
  public close = sinon.stub();

  public completionCharacters: string[];
  public signatureCharacters: string[];

  constructor() {
    this.completionCharacters = ['.', ','];
    this.signatureCharacters = ['('];
  }

  public on(type: string, listener: (...args: any) => void) {
    const listeners = this.listeners[type];
    if (!listeners) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }

  public off(type: string, listener: (...args: any) => void) {
    const listeners = this.listeners[type];
    if (!listeners) {
      return;
    }

    const index = listeners.findIndex(l => l === listener);
    if (index > -1) {
      this.listeners[type].splice(index);
    }
  }

  public getLanguageCompletionCharacters() {
    return this.completionCharacters;
  }
  public getLanguageSignatureCharacters() {
    return this.signatureCharacters;
  }
}
