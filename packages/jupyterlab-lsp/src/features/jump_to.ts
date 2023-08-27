import { EditorView } from '@codemirror/view';
import {
  CodeJumper,
  FileEditorJumper,
  NotebookJumper
} from '@jupyter-lsp/code-jumpers';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  InputDialog,
  ICommandPalette,
  Notification
} from '@jupyterlab/apputils';
import {
  CodeMirrorEditor,
  IEditorExtensionRegistry,
  EditorExtensionRegistry
} from '@jupyterlab/codemirror';
import { URLExt } from '@jupyterlab/coreutils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { IEditorTracker } from '@jupyterlab/fileeditor';
import {
  IVirtualPosition,
  ProtocolCoordinates,
  WidgetLSPAdapter,
  ILSPFeatureManager,
  ILSPDocumentConnectionManager
} from '@jupyterlab/lsp';
import { AnyLocation } from '@jupyterlab/lsp/lib/lsp';
import { INotebookTracker } from '@jupyterlab/notebook';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import {
  ITranslator,
  TranslationBundle,
  nullTranslator
} from '@jupyterlab/translation';
import { LabIcon } from '@jupyterlab/ui-components';
import type * as lsp from 'vscode-languageserver-protocol';
import * as lsProtocol from 'vscode-languageserver-protocol';

import jumpToSvg from '../../style/icons/jump-to.svg';
import { CodeJump as LSPJumpSettings, ModifierKey } from '../_jump_to';
import { ContextAssembler } from '../context';
import {
  PositionConverter,
  documentAtRootPosition,
  rootPositionToVirtualPosition,
  rootPositionToEditorPosition,
  virtualPositionToRootPosition
} from '../converter';
import { FeatureSettings, Feature } from '../feature';
import { PLUGIN_ID } from '../tokens';
import { getModifierState, uriToContentsPath, urisEqual } from '../utils';
import { BrowserConsole } from '../virtual/console';

export const jumpToIcon = new LabIcon({
  name: 'lsp:jump-to',
  svgstr: jumpToSvg
});

const jumpBackIcon = new LabIcon({
  name: 'lsp:jump-back',
  svgstr: jumpToSvg.replace('jp-icon3', 'lsp-icon-flip-x jp-icon3')
});

const enum JumpResult {
  NoTargetsFound = 1,
  PositioningFailure = 2,
  PathResolutionFailure = 3,
  AssumeSuccess = 4,
  UnspecifiedFailure = 5,
  AlreadyAtTarget = 6
}

export class NavigationFeature extends Feature {
  readonly id = NavigationFeature.id;
  readonly capabilities: lsProtocol.ClientCapabilities = {
    textDocument: {
      declaration: {
        dynamicRegistration: true,
        linkSupport: true
      },
      definition: {
        dynamicRegistration: true,
        linkSupport: true
      },
      typeDefinition: {
        dynamicRegistration: true,
        linkSupport: true
      },
      implementation: {
        dynamicRegistration: true,
        linkSupport: true
      }
    }
  };
  protected settings: FeatureSettings<LSPJumpSettings>;
  protected console = new BrowserConsole().scope('Navigation');
  protected contextAssembler: ContextAssembler;

  constructor(options: NavigationFeature.IOptions) {
    super(options);
    this.settings = options.settings;
    this._trans = options.trans;
    this.contextAssembler = options.contextAssembler;
    const connectionManager = options.connectionManager;

    options.editorExtensionRegistry.addExtension({
      name: 'lsp:jump',
      factory: options => {
        const clickListener = EditorView.domEventHandlers({
          mouseup: event => {
            const adapter = [...connectionManager.adapters.values()].find(
              adapter =>
                adapter.widget.node.contains(event.target as HTMLElement)
            );

            if (!adapter) {
              this.console.warn('Adapter not found');
              return;
            }
            this._jumpOnMouseUp(event, adapter);
          }
        });

        return EditorExtensionRegistry.createImmutableExtension([
          clickListener
        ]);
      }
    });

    this._jumpers = new Map();
    const { fileEditorTracker, notebookTracker, documentManager } = options;

    if (fileEditorTracker !== null) {
      fileEditorTracker.widgetAdded.connect((_, widget) => {
        let fileEditor = widget.content;

        if (fileEditor.editor instanceof CodeMirrorEditor) {
          let jumper = new FileEditorJumper(widget, documentManager);
          this._jumpers.set(widget.id, jumper);
        }
      });
    }

    notebookTracker.widgetAdded.connect(async (_, widget) => {
      let jumper = new NotebookJumper(widget, documentManager);
      this._jumpers.set(widget.id, jumper);
    });
  }

  getJumper(adapter: WidgetLSPAdapter<any>): CodeJumper {
    let current = adapter.widget.id;
    return this._jumpers.get(current)!;
  }

  protected get modifierKey(): ModifierKey {
    return this.settings.composite.modifierKey;
  }

  private _jumpOnMouseUp(event: MouseEvent, adapter: WidgetLSPAdapter<any>) {
    // For Alt + click we need to wait for mouse up to enable users to create
    // rectangular selections with Alt + drag.
    if (this.modifierKey === 'Alt') {
      document.body.addEventListener(
        'mouseup',
        (mouseUpEvent: MouseEvent) => {
          if (mouseUpEvent.target !== event.target) {
            // Cursor moved, possibly block selection was attempted, see:
            // https://github.com/jupyter-lsp/jupyterlab-lsp/issues/823
            return;
          }
          return this._jumpToDefinitionOrRefernce(event, adapter);
        },
        {
          once: true
        }
      );
    } else {
      // For Ctrl + click we need to act on mouse down to prevent
      // adding multiple cursors if jump were to occur.
      return this._jumpToDefinitionOrRefernce(event, adapter);
    }
  }

  private _jumpToDefinitionOrRefernce(
    event: MouseEvent,
    adapter: WidgetLSPAdapter<any>
  ) {
    const { button } = event;
    const shouldJump =
      button === 0 && getModifierState(event, this.modifierKey);
    if (!shouldJump) {
      return;
    }

    const rootPosition = this.contextAssembler.positionFromCoordinates(
      event.clientX,
      event.clientY,
      adapter
    );

    if (rootPosition == null) {
      this.console.warn(
        'Could not retrieve root position from mouse event to jump to definition/reference'
      );
      return;
    }

    const virtualPosition = rootPositionToVirtualPosition(
      adapter,
      rootPosition
    );
    const document = documentAtRootPosition(adapter, rootPosition);

    const connection = this.connectionManager.connections.get(document.uri)!;

    const positionParams: lsp.TextDocumentPositionParams = {
      textDocument: {
        uri: document.documentInfo.uri
      },
      position: {
        line: virtualPosition.line,
        character: virtualPosition.ch
      }
    };

    connection.clientRequests['textDocument/definition']
      .request(positionParams)
      .then(targets => {
        this.handleJump(targets, positionParams, adapter)
          .then((result: JumpResult | undefined) => {
            if (
              result === JumpResult.NoTargetsFound ||
              result === JumpResult.AlreadyAtTarget
            ) {
              // definition was not found, or we are in definition already, suggest references
              connection.clientRequests['textDocument/references']
                .request({
                  ...positionParams,
                  context: { includeDeclaration: false }
                })
                .then(targets =>
                  // TODO: explain that we are now presenting references?
                  this.handleJump(targets, positionParams, adapter)
                )
                .catch(this.console.warn);
            }
          })
          .catch(this.console.warn);
      })
      .catch(this.console.warn);

    event.preventDefault();
    event.stopPropagation();
  }

  private _harmonizeLocations(locationData: AnyLocation): lsp.Location[] {
    if (locationData == null) {
      return [];
    }

    const locationsList = Array.isArray(locationData)
      ? locationData
      : [locationData];

    return (locationsList as (lsp.Location | lsp.LocationLink)[])
      .map((locationOrLink): lsp.Location | undefined => {
        if ('targetUri' in locationOrLink) {
          return {
            uri: locationOrLink.targetUri,
            range: locationOrLink.targetRange
          };
        } else if ('uri' in locationOrLink) {
          return {
            uri: locationOrLink.uri,
            range: locationOrLink.range
          };
        } else {
          this.console.warn(
            'Returned jump location is incorrect (no uri or targetUri):',
            locationOrLink
          );
          return undefined;
        }
      })
      .filter((location): location is lsp.Location => location != null);
  }

  private async _chooseTarget(locations: lsp.Location[]) {
    if (locations.length > 1) {
      const choices = locations.map(location => {
        // TODO: extract the line, the line above and below, and show it
        const path = this._resolvePath(location.uri) || location.uri;
        return path + ', line: ' + location.range.start.line;
      });

      // TODO: use selector with preview, basically needes the ui-component
      // from jupyterlab-citation-manager; let's try to move it to JupyterLab core
      // (and re-implement command palette with it)
      // the preview should use this.jumper.document_manager.services.contents

      let getItemOptions = {
        title: this._trans.__('Choose the jump target'),
        okLabel: this._trans.__('Jump'),
        items: choices
      };
      // TODO: use showHints() or completion-like widget instead?
      const choice = await InputDialog.getItem(getItemOptions).catch(
        this.console.warn
      );
      if (!choice || choice.value == null) {
        this.console.warn('No choice selected for jump location selection');
        return;
      }
      const choiceIndex = choices.indexOf(choice.value);
      if (choiceIndex === -1) {
        this.console.error(
          'Choice selection error: please report this as a bug:',
          choices,
          choice
        );
        return;
      }
      return locations[choiceIndex];
    } else {
      return locations[0];
    }
  }

  private _resolvePath(uri: string): string | null {
    let contentsPath = uriToContentsPath(uri);

    if (contentsPath == null) {
      if (uri.startsWith('file://')) {
        contentsPath = decodeURIComponent(uri.slice(7));
      } else {
        contentsPath = decodeURIComponent(uri);
      }
    }
    return contentsPath;
  }

  async handleJump(
    locationData: AnyLocation,
    positionParams: lsp.TextDocumentPositionParams,
    adapter: WidgetLSPAdapter<any>
  ) {
    const locations = this._harmonizeLocations(locationData);
    const targetInfo = await this._chooseTarget(locations);
    const jumper = this.getJumper(adapter);

    if (!targetInfo) {
      Notification.info(this._trans.__('No jump targets found'), {
        autoClose: 3 * 1000
      });
      return JumpResult.NoTargetsFound;
    }

    let { uri, range } = targetInfo;

    let virtualPosition = PositionConverter.lsp_to_cm(
      range.start
    ) as IVirtualPosition;

    if (urisEqual(uri, positionParams.textDocument.uri)) {
      let editorIndex = adapter.getEditorIndexAt(virtualPosition);
      // if in current file, transform from the position within virtual document to the editor position:
      const rootPosition = virtualPositionToRootPosition(
        adapter,
        virtualPosition
      );
      if (rootPosition === null) {
        this.console.warn(
          'Could not jump: conversion from virtual position to editor position failed',
          virtualPosition
        );
        return JumpResult.PositioningFailure;
      }
      const editorPosition = rootPositionToEditorPosition(
        adapter,
        rootPosition
      );

      this.console.log(`Jumping to ${editorIndex}th editor of ${uri}`);
      this.console.log('Jump target within editor:', editorPosition);

      let contentsPath = adapter.widget.context.path;

      const didUserChooseThis = locations.length > 1;

      // note: we already know that URIs are equal, so just check the position range
      if (
        !didUserChooseThis &&
        ProtocolCoordinates.isWithinRange(positionParams.position, range)
      ) {
        return JumpResult.AlreadyAtTarget;
      }

      jumper.globalJump({
        line: editorPosition.line,
        column: editorPosition.ch,
        editorIndex,
        isSymlink: false,
        contentsPath
      });
      return JumpResult.AssumeSuccess;
    } else {
      // otherwise there is no virtual document and we expect the returned position to be source position:
      let sourcePosition = PositionConverter.cm_to_ce(virtualPosition);
      this.console.log(`Jumping to external file: ${uri}`);
      this.console.log('Jump target (source location):', sourcePosition);

      let jumpData = {
        editorIndex: 0,
        line: sourcePosition.line,
        column: sourcePosition.column
      };

      // assume that we got a relative path to a file within the project
      // TODO use is_relative() or something? It would need to be not only compatible
      //  with different OSes but also with JupyterHub and other platforms.

      // can it be resolved vs our guessed server root?
      const contentsPath = this._resolvePath(uri);

      if (contentsPath === null) {
        this.console.warn('contents_path could not be resolved');
        return JumpResult.PathResolutionFailure;
      }

      try {
        await jumper.documentManager.services.contents.get(contentsPath, {
          content: false
        });
        jumper.globalJump({
          contentsPath,
          ...jumpData,
          isSymlink: false
        });
        return JumpResult.AssumeSuccess;
      } catch (err) {
        this.console.warn(err);
      }

      // TODO: user debugger source request?
      jumper.globalJump({
        contentsPath: URLExt.join('.lsp_symlink', contentsPath),
        ...jumpData,
        isSymlink: true
      });
      return JumpResult.AssumeSuccess;
    }
  }

  private _trans: TranslationBundle;
  private _jumpers: Map<string, CodeJumper>;
}

export namespace NavigationFeature {
  export interface IOptions extends Feature.IOptions {
    settings: FeatureSettings<LSPJumpSettings>;
    trans: TranslationBundle;
    notebookTracker: INotebookTracker;
    documentManager: IDocumentManager;
    contextAssembler: ContextAssembler;
    editorExtensionRegistry: IEditorExtensionRegistry;
    fileEditorTracker: IEditorTracker | null;
  }
  export const id = PLUGIN_ID + ':jump_to';
}

export namespace CommandIDs {
  export const jumpToDefinition = 'lsp:jump-to-definition';
  export const jumpToReference = 'lsp:jump-to-reference';
  export const jumpBack = 'lsp:jump-back';
}

export const JUMP_PLUGIN: JupyterFrontEndPlugin<void> = {
  id: NavigationFeature.id,
  requires: [
    ILSPFeatureManager,
    ISettingRegistry,
    ILSPDocumentConnectionManager,
    INotebookTracker,
    IDocumentManager,
    IEditorExtensionRegistry
  ],
  optional: [IEditorTracker, ICommandPalette, ITranslator],
  autoStart: true,
  activate: async (
    app: JupyterFrontEnd,
    featureManager: ILSPFeatureManager,
    settingRegistry: ISettingRegistry,
    connectionManager: ILSPDocumentConnectionManager,
    notebookTracker: INotebookTracker,
    documentManager: IDocumentManager,
    editorExtensionRegistry: IEditorExtensionRegistry,
    fileEditorTracker: IEditorTracker | null,
    palette: ICommandPalette | null,
    translator: ITranslator | null
  ) => {
    const trans = (translator || nullTranslator).load('jupyterlab_lsp');
    const contextAssembler = new ContextAssembler({ app, connectionManager });
    const settings = new FeatureSettings<LSPJumpSettings>(
      settingRegistry,
      NavigationFeature.id
    );
    await settings.ready;

    if (settings.composite.disable) {
      return;
    }

    const feature = new NavigationFeature({
      settings,
      connectionManager,
      notebookTracker,
      documentManager,
      fileEditorTracker,
      contextAssembler,
      editorExtensionRegistry,
      trans
    });
    featureManager.register(feature);

    const assembler = new ContextAssembler({
      app,
      connectionManager
    });

    app.commands.addCommand(CommandIDs.jumpToDefinition, {
      execute: async () => {
        const context = assembler.getContext();
        if (!context) {
          console.warn('Could not get context');
          return;
        }
        const { connection, virtualPosition, document, adapter } = context;

        if (!connection) {
          Notification.warning(trans.__('Connection not found for jump'), {
            autoClose: 4 * 1000
          });
          return;
        }

        const positionParams: lsp.TextDocumentPositionParams = {
          textDocument: {
            uri: document.documentInfo.uri
          },
          position: {
            line: virtualPosition.line,
            character: virtualPosition.ch
          }
        };
        const targets = await connection.clientRequests[
          'textDocument/definition'
        ].request(positionParams);
        await feature.handleJump(targets, positionParams, adapter);
      },
      label: trans.__('Jump to definition'),
      icon: jumpToIcon,
      isEnabled: () => {
        const context = assembler.getContext();
        if (!context) {
          console.warn('Could not get context');
          return false;
        }
        const { connection } = context;
        return connection ? connection.provides('definitionProvider') : false;
      }
    });

    app.commands.addCommand(CommandIDs.jumpToReference, {
      execute: async () => {
        const context = assembler.getContext();
        if (!context) {
          console.warn('Could not get context');
          return;
        }
        const { connection, virtualPosition, document, adapter } = context;

        if (!connection) {
          Notification.warning(trans.__('Connection not found for jump'), {
            autoClose: 5 * 1000
          });
          return;
        }

        const positionParams: lsp.TextDocumentPositionParams = {
          textDocument: {
            uri: document.documentInfo.uri
          },
          position: {
            line: virtualPosition.line,
            character: virtualPosition.ch
          }
        };
        const targets = await connection.clientRequests[
          'textDocument/references'
        ].request({
          ...positionParams,
          context: { includeDeclaration: false }
        });
        await feature.handleJump(targets, positionParams, adapter);
      },
      label: trans.__('Jump to references'),
      icon: jumpToIcon,
      isEnabled: () => {
        const context = assembler.getContext();
        if (!context) {
          console.warn('Could not get context');
          return false;
        }
        const { connection } = context;
        return connection ? connection.provides('referencesProvider') : false;
      }
    });

    app.commands.addCommand(CommandIDs.jumpBack, {
      execute: async () => {
        const context = assembler.getContext();
        if (!context) {
          console.warn('Could not get context');
          return;
        }
        feature.getJumper(context.adapter).globalJumpBack();
      },
      label: trans.__('Jump back'),
      icon: jumpBackIcon,
      isEnabled: () => {
        const context = assembler.getContext();
        if (!context) {
          console.warn('Could not get context');
          return false;
        }
        const { connection } = context;
        return connection
          ? connection.provides('definitionProvider') ||
              connection.provides('referencesProvider')
          : false;
      }
    });

    for (const commandID of [
      CommandIDs.jumpToDefinition,
      CommandIDs.jumpToReference
    ]) {
      // add to menus
      app.contextMenu.addItem({
        selector: '.jp-Notebook .jp-CodeCell .jp-Editor',
        command: commandID,
        rank: 10
      });

      app.contextMenu.addItem({
        selector: '.jp-FileEditor',
        command: commandID,
        rank: 0
      });
    }

    for (const commandID of [
      CommandIDs.jumpToDefinition,
      CommandIDs.jumpToReference,
      CommandIDs.jumpBack
    ]) {
      if (palette) {
        palette.addItem({
          command: commandID,
          category: trans.__('Language Server Protocol')
        });
      }
    }
  }
};
