import {
  IForeignCodeExtractor,
  ILSPCodeExtractorsManager
} from '@jupyterlab/lsp';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { PromiseDelegate } from '@lumino/coreutils';
import { Debouncer } from '@lumino/polling';
import { Signal, ISignal } from '@lumino/signaling';

import { RegExpForeignCodeExtractor } from '../../api';

import * as SCHEMA from './_transclusions';
import { ILSPCustomTransclusionsManager, PLUGIN_ID } from './tokens';

const CELL_TYPES: CustomTransclusionsManager.TCellType[] = [
  'code',
  'markdown',
  'raw'
];

/**
 * Manage declarative patterns of host/foreign language transclusions
 */
export class CustomTransclusionsManager
  implements ILSPCustomTransclusionsManager
{
  extractorsManager: ILSPCodeExtractorsManager;
  settingsRegistry: ISettingRegistry;

  constructor(options: CustomTransclusionsManager.IOptions) {
    this.extractorsManager = options.extractorsManager;
    this.settingsRegistry = options.settingsRegistry;
  }

  /**
   * A signal that emits when extractors change and are ready to be (re)used.
   */
  get extractorsChanged(): ISignal<CustomTransclusionsManager, void> {
    return this._extractorsChanged;
  }

  /**
   * A promise that resolves when the manager is initialized.
   */
  get ready() {
    return this._ready.promise;
  }

  /**
   * Request the settings and initialize.
   */
  async initialize() {
    this._settings = await this.settingsRegistry.load(PLUGIN_ID);
    this._settings.changed.connect(this.onSettings, this);
    this._onSettings();
    this._ready.resolve(void 0);
  }

  protected onSettings(): Promise<void> {
    return this._debouncedOnSettings.invoke();
  }

  /**
   * Update the upstream extractors based on settings.
   */
  protected _onSettings(): void {
    this.cleanExtractors();

    if (this.enabled) {
      for (const [key, model] of Object.entries(this.extractorModels)) {
        this.ensureOneExtractor(key, model);
      }
    }

    this._extractorsChanged.emit(void 0);
  }

  /**
   * Whether settings-based extractors should be used.
   */
  protected get enabled() {
    return this._settings.composite['enabled'];
  }

  /**
   * Typed getter for settings.
   */
  protected get extractorModels(): CustomTransclusionsManager.TModels {
    return this._settings.composite['codeExtractors'] as any;
  }

  /**
   * Remove all of the extractors added by this plugin.
   */
  protected cleanExtractors() {
    this.forAllExtractors(this.cleanExtractor);
    this._extractorsByHost = new Map();
  }

  /**
   * Clean a single extractor.
   */
  protected cleanExtractor(
    options: CustomTransclusionsManager.IForAllOptions
  ): void {
    const { hostLanguage, cellType, extractor } = options;
    const managed = this.extractorsManager.getExtractors(
      cellType,
      hostLanguage
    );
    if (managed.length && managed.includes(extractor)) {
      managed.splice(managed.indexOf(extractor), 1);
    }
  }

  /**
   * Convenience method for running functions for all extractors
   */
  protected forAllExtractors(fn: CustomTransclusionsManager.IForAllBack) {
    for (const [
      hostLanguage,
      hostExtractors
    ] of this._extractorsByHost.entries()) {
      for (const extractor of hostExtractors.values()) {
        for (const cellType of CELL_TYPES) {
          fn({ hostLanguage, extractor, cellType });
        }
      }
    }
  }

  /**
   * Register a new extractor.
   */
  protected ensureOneExtractor(
    key: string,
    model: SCHEMA.ACodeExtractor
  ): void {
    let _hostExtractors = this.hostExtractors(model.hostLanguage);
    const extractor = this.createNew(model);
    _hostExtractors.set(key, extractor);
    this.extractorsManager.register(extractor, model.hostLanguage);
  }

  /**
   * Get the known host extractors for host language.
   */
  protected hostExtractors(
    hostLanguage: string
  ): CustomTransclusionsManager.THostExtractorMap {
    let _hostExtractors = this._extractorsByHost.get(hostLanguage);
    if (_hostExtractors == null) {
      _hostExtractors = new Map();
      this._extractorsByHost.set(hostLanguage, _hostExtractors);
    }
    return _hostExtractors;
  }

  /** Create a new extractor from a model */
  protected createNew(
    model: SCHEMA.ACodeExtractor
  ): RegExpForeignCodeExtractor {
    const options = this.schemaToOptions(model);
    return new RegExpForeignCodeExtractor(options);
  }

  /**
   * Transform a settings model into the constructor options for an extractor
   */
  protected schemaToOptions(
    model: SCHEMA.ACodeExtractor
  ): RegExpForeignCodeExtractor.IOptions {
    return {
      pattern: model.pattern,
      cellTypes: model.cellTypes || ['code'],
      fileExtension: model.fileExtension,
      foreignCaptureGroups: model.foreignCaptureGroups,
      isStandalone: model.isStandalone,
      language: model.foreignLanguage
    };
  }

  protected _ready = new PromiseDelegate<void>();
  protected _extractorsByHost = new Map<
    string,
    CustomTransclusionsManager.THostExtractorMap
  >();
  protected _settings: ISettingRegistry.ISettings;
  protected _extractorsChanged = new Signal<CustomTransclusionsManager, void>(
    this
  );
  protected _debouncedOnSettings = new Debouncer(this._onSettings);
}

/**
 * A namespace for settings-based extractors
 */
export namespace CustomTransclusionsManager {
  /** Constructor options for `CustomTransclusionsManager` */
  export interface IOptions {
    extractorsManager: ILSPCodeExtractorsManager;
    settingsRegistry: ISettingRegistry;
  }
  export type THostExtractorMap = Map<string, RegExpForeignCodeExtractor>;
  export type TModels = Record<string, SCHEMA.ACodeExtractor>;
  export type TCellType = 'code' | 'markdown' | 'raw';
  export interface IForAllOptions {
    extractor: IForeignCodeExtractor;
    hostLanguage: string;
    cellType: TCellType;
  }
  export interface IForAllBack {
    (options: IForAllOptions): void;
  }
}
