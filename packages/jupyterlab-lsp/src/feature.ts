import { IFeature } from '@jupyterlab/lsp';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { PromiseDelegate } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';
import * as lsProtocol from 'vscode-languageserver-protocol';

export interface IFeatureSettings<T> {
  readonly composite: Required<T>;
  readonly changed: Signal<IFeatureSettings<T>, void>;
  readonly ready?: Promise<void>;

  set(setting: keyof T, value: any): void;
}
import { ILSPDocumentConnectionManager } from './connection_manager';

export namespace Feature {
  export interface IOptions {
    connectionManager: ILSPDocumentConnectionManager;
  }
}

export abstract class Feature implements IFeature {
  abstract readonly id: string;
  abstract readonly capabilities?: lsProtocol.ClientCapabilities;
  protected connectionManager: ILSPDocumentConnectionManager;

  constructor(options: Feature.IOptions) {
    this.connectionManager = options.connectionManager;
  }

  //getConnection(): ILSPConnection {

  //}
}

export class FeatureSettings<T> implements IFeatureSettings<T> {
  protected settings: ISettingRegistry.ISettings;
  public changed: Signal<FeatureSettings<T>, void>;
  private _ready = new PromiseDelegate<void>();

  constructor(protected settingRegistry: ISettingRegistry, featureID: string) {
    this.changed = new Signal(this);
    if (!(featureID in settingRegistry.plugins)) {
      this._ready.reject(
        `${featureID} settings schema could not be found and was not loaded`
      );
    } else {
      settingRegistry
        .load(featureID)
        .then(settings => {
          this.settings = settings;
          this._ready.resolve(void 0);
          this.changed.emit();
          settings.changed.connect(() => {
            this.settings = settings;
            this.changed.emit();
          });
        })
        .catch(console.warn);
    }
  }

  get ready(): Promise<void> {
    return this._ready.promise;
  }

  get composite(): Required<T> {
    return this.settings.composite as unknown as Required<T>;
  }

  set(setting: keyof T, value: any) {
    this.settings.set(setting as string, value).catch(console.warn);
  }
}
