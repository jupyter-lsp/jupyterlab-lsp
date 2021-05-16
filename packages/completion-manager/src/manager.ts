import { JupyterFrontEnd } from '@jupyterlab/application';
import {
  CompletionHandler,
  ICompletionManager as IOldCompletionManager
} from '@jupyterlab/completer';
import { NotebookPanel } from '@jupyterlab/notebook';
import { LabIcon } from '@jupyterlab/ui-components';

import { MultiSourceCompletionConnector } from './connector';
import { GenericCompleterModel } from './model';
import { DispatchRenderer } from './renderer';
import {
  CompletionTriggerKind,
  ICompletionContext,
  ICompletionProvider,
  ICompletionProviderManager,
  ICompletionSettings,
  IIconSource
} from './tokens';

class NullIconSource implements IIconSource {
  iconFor(completionType: string): LabIcon {
    return null;
  }
}

export class CompletionProviderManager implements ICompletionProviderManager {
  private readonly _providers: Map<string, ICompletionProvider>;
  private readonly _renderer: DispatchRenderer;
  private _iconSource: IIconSource;
  private _connector: MultiSourceCompletionConnector;
  private _handler: CompletionHandler;
  private _context: ICompletionContext;
  private _settings: ICompletionSettings;

  constructor(
    private _app: JupyterFrontEnd,
    private _oldCompletionManager: IOldCompletionManager
  ) {
    this._providers = new Map();
    this._iconSource = new NullIconSource();
    this._renderer = new DispatchRenderer(this._providers);
  }

  registerProvider(provider: ICompletionProvider): void {
    if (this._providers.has(provider.identifier)) {
      console.warn(provider.identifier, 'already registered');
    }
    this._providers.set(provider.identifier, provider);
  }

  getProvider(identifier: string): ICompletionProvider {
    return this._providers.get(identifier);
  }

  overrideProvider(provider: ICompletionProvider): void {
    // TODO
    this.registerProvider(provider);
  }

  setIconSource(iconSource: IIconSource): void {
    this._iconSource = iconSource;
  }

  invoke(trigger: CompletionTriggerKind) {
    // TODO: ideally this would not re-trigger if list of items not isIncomplete
    let command: string;
    this._connector.triggerKind = trigger;

    if (this._context.widget instanceof NotebookPanel) {
      command = 'completer:invoke-notebook';
    } else {
      command = 'completer:invoke-file';
    }
    return this._app.commands.execute(command).catch(() => {
      this._connector.triggerKind = CompletionTriggerKind.Invoked;
    });
  }

  configure(settings: ICompletionSettings) {
    Object.assign(this._settings, settings);
  }

  // TODO: make it private maybe? This is when LSP would want more control, but it does not make sense to
  // have it like that in core.
  public connect(
    context: ICompletionContext,
    model: GenericCompleterModel<CompletionHandler.ICompletionItem>
  ) {
    if (this._connector) {
      delete this._connector;
    }
    this._context = context;
    this._connector = new MultiSourceCompletionConnector({
      iconSource: this._iconSource,
      settings: this._settings,
      context: context,
      providers: [...this._providers.values()]
    });
    this._handler = this._oldCompletionManager.register(
      {
        connector: this._connector,
        editor: context.editor,
        parent: context.widget
      },
      this._renderer
    ) as CompletionHandler;

    let completer = this.completer;
    completer.addClass('lsp-completer');
    completer.model = model;
  }

  get completer() {
    // TODO upstream: make completer public?
    return this._handler.completer;
  }

  get model() {
    return this.completer.model;
  }
}
