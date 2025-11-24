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
  Notification,
  showErrorMessage
} from '@jupyterlab/apputils';
import {
  CodeMirrorEditor,
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
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { KernelMessage, ServerConnection } from '@jupyterlab/services';
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
  editorAtRootPosition,
  rootPositionToVirtualPosition,
  rootPositionToEditorPosition
} from '../converter';
import { FeatureSettings, Feature } from '../feature';
import { PLUGIN_ID } from '../tokens';
import { getModifierState, uriToContentsPath, urisEqual } from '../utils';
import { BrowserConsole } from '../virtual/console';
import { VirtualDocument } from '../virtual/document';

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
    this._notebookTracker = options.notebookTracker;
    this._documentManager = options.documentManager;

    this.extensionFactory = {
      name: 'lsp:jump',
      factory: factoryOptions => {
        const { widgetAdapter: adapter } = factoryOptions;
        const clickListener = EditorView.domEventHandlers({
          mouseup: event => {
            this._jumpOnMouseUp(event, adapter);
          }
        });

        return EditorExtensionRegistry.createImmutableExtension([
          clickListener
        ]);
      }
    };

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

    const accessorFromNode = this.contextAssembler.editorFromNode(
      adapter,
      event.target as HTMLElement
    );
    if (!accessorFromNode) {
      this.console.warn(
        'Editor accessor not found from node, falling back to activeEditor'
      );
    }
    const editorAccessor = accessorFromNode
      ? accessorFromNode
      : adapter.activeEditor;

    const rootPosition = this.contextAssembler.positionFromCoordinates(
      event.clientX,
      event.clientY,
      adapter,
      editorAccessor
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
        this.handleJump(targets, positionParams, adapter, document)
          .then(async (result: JumpResult | undefined) => {
            if (result === JumpResult.NoTargetsFound) {
              // Try kernel Jedi fallback for Python notebooks before references
              const enableKernelFallback =
                this.settings.composite.enableKernelFallback !== false;
              const notebook = this._notebookTracker.currentWidget;
              if (
                enableKernelFallback &&
                notebook &&
                notebook.sessionContext.session?.kernel &&
                this.isPythonNotebook(notebook)
              ) {
                this.console.log(
                  '[LSP] LSP returned no targets, trying kernel Jedi fallback'
                );
                const kernelResult = await this.jumpWithKernelJedi(
                  notebook,
                  this._documentManager
                );
                if (kernelResult === JumpResult.AssumeSuccess) {
                  return; // Kernel fallback succeeded
                }
              }
              // Fall through to references if kernel fallback didn't work
            }
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
                  this.handleJump(targets, positionParams, adapter, document)
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

      // TODO: use selector with preview, basically needs the ui-component
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
    adapter: WidgetLSPAdapter<any>,
    document: VirtualDocument
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
      // if in current file, transform from the position within virtual document to the editor position:

      // because `openForeign()` does not use new this.constructor, we need to workaround it for now:
      // const rootPosition = document.transformVirtualToRoot(virtualPosition);
      // https://github.com/jupyterlab/jupyterlab/issues/15126
      const rootPosition =
        VirtualDocument.prototype.transformVirtualToRoot.call(
          document,
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

      const editorAccessor = editorAtRootPosition(adapter, rootPosition);

      // TODO: getEditorIndex should work, but does not
      // adapter.getEditorIndex(editorAccessor)
      await editorAccessor.reveal();
      const editor = editorAccessor.getEditor();
      const editorIndex = adapter.editors.findIndex(
        e => e.ceEditor.getEditor() === editor
      );
      if (editorIndex === -1) {
        return JumpResult.PositioningFailure;
      }

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

  /**
   * Check if the current notebook is running a Python kernel.
   */
  isPythonNotebook(notebook: NotebookPanel): boolean {
    const kernelName = notebook.sessionContext.kernelDisplayName || '';
    const isPython =
      kernelName === 'Python 3 (ipykernel)' ||
      kernelName.toLowerCase().includes('python');
    this.console.log(
      `[KernelJedi] isPythonNotebook check: kernelName="${kernelName}", isPython=${isPython}`
    );
    return isPython;
  }

  /**
   * Fetch introspection code template from the server.
   */
  private async _fetchIntrospectionCode(): Promise<string | null> {
    try {
      const settings = ServerConnection.makeSettings();
      const url = URLExt.join(settings.baseUrl, 'lsp', 'introspection-code');
      const response = await ServerConnection.makeRequest(url, {}, settings);
      if (!response.ok) {
        this.console.warn(
          'Failed to fetch introspection code:',
          response.status
        );
        return null;
      }
      const data = await response.json();
      return data.code;
    } catch (err) {
      this.console.warn('Error fetching introspection code:', err);
      return null;
    }
  }

  /**
   * Execute Jedi-based jump-to-definition in the kernel environment.
   * This is used as a fallback when LSP returns no results, enabling
   * jump-to-definition for packages installed in the kernel environment.
   */
  async jumpWithKernelJedi(
    notebook: NotebookPanel,
    documentManager: IDocumentManager
  ): Promise<JumpResult> {
    this.console.log('[KernelJedi] Starting kernel-based jump-to-definition');
    const kernel = notebook.sessionContext.session?.kernel;
    if (!kernel) {
      this.console.warn('[KernelJedi] No kernel available');
      return JumpResult.UnspecifiedFailure;
    }
    this.console.log(`[KernelJedi] Kernel found: ${kernel.name}`);

    // Get active cell and cursor position
    const activeCell = notebook.content.activeCell;
    if (!activeCell || activeCell.model.type !== 'code') {
      this.console.warn('[KernelJedi] No active code cell');
      await showErrorMessage(
        this._trans.__('Jump to Definition'),
        this._trans.__('No active code cell')
      );
      return JumpResult.UnspecifiedFailure;
    }
    this.console.log(`[KernelJedi] Active cell type: ${activeCell.model.type}`);

    const editor = activeCell.editor;
    if (!editor) {
      return JumpResult.UnspecifiedFailure;
    }

    const cursor = editor.getCursorPosition();

    // Collect all code cell sources and calculate absolute position
    const cells = notebook.content.widgets;
    const cellSources: string[] = [];
    let activeCellIndex = -1;

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (cell === activeCell) {
        activeCellIndex = i;
      }
      if (cell.model.type === 'code') {
        cellSources.push(cell.model.sharedModel.getSource());
      }
    }

    // Concatenate all cell sources with newlines
    const notebookSource = cellSources.join('\n');

    // Calculate absolute line number (Jedi uses 1-based line numbers)
    let absoluteLine = cursor.line + 1;
    for (let i = 0; i < activeCellIndex; i++) {
      const cell = cells[i];
      if (cell.model.type === 'code') {
        const source = cell.model.sharedModel.getSource();
        absoluteLine += source.split('\n').length;
      }
    }

    const absoluteColumn = cursor.column;
    const notebookPath = notebook.context.path;

    this.console.log(
      `[KernelJedi] Cursor position: line=${cursor.line}, column=${cursor.column}`
    );
    this.console.log(
      `[KernelJedi] Absolute position: line=${absoluteLine}, column=${absoluteColumn}`
    );
    this.console.log(`[KernelJedi] Notebook path: ${notebookPath}`);
    this.console.log(
      `[KernelJedi] Total notebook source length: ${notebookSource.length} chars`
    );

    // Get introspection code from server
    this.console.log('[KernelJedi] Fetching introspection code from server...');
    const introspectionCode = await this._fetchIntrospectionCode();
    if (!introspectionCode) {
      this.console.warn('[KernelJedi] Could not fetch introspection code');
      return JumpResult.UnspecifiedFailure;
    }
    this.console.log('[KernelJedi] Introspection code fetched successfully');

    // Replace placeholders in the introspection code
    const jediCode = introspectionCode
      .replace('__NOTEBOOK_SOURCE__', JSON.stringify(notebookSource))
      .replace('__CURSOR_LINE__', String(absoluteLine))
      .replace('__CURSOR_COLUMN__', String(absoluteColumn))
      .replace('__NOTEBOOK_PATH__', JSON.stringify(notebookPath));

    this.console.log('[KernelJedi] Executing Jedi code in kernel...');
    // Execute in kernel
    const future = kernel.requestExecute({ code: jediCode });
    let output = '';

    future.onIOPub = (msg: KernelMessage.IIOPubMessage) => {
      if (msg.header.msg_type === 'stream') {
        const content = msg.content as KernelMessage.IStreamMsg['content'];
        // Only capture stdout (JSON result), not stderr (debug logs)
        if (content.name === 'stdout') {
          output += content.text;
        }
      }
    };

    await future.done;
    this.console.log('[KernelJedi] Kernel execution completed');
    this.console.log(`[KernelJedi] Raw output: ${output}`);

    // Parse result
    let result: {
      file: string | null;
      line: number | null;
      error: string | null;
    };
    try {
      result = JSON.parse(output.trim());
      this.console.log('[KernelJedi] Parsed result:', result);
    } catch (e) {
      this.console.warn('[KernelJedi] Failed to parse result:', output);
      return JumpResult.UnspecifiedFailure;
    }

    if (result.error) {
      this.console.log('[KernelJedi] Error:', result.error);
      // Don't show notification for "No definition found" - just fall through silently
      if (result.error !== 'No definition found') {
        Notification.warning(result.error, { autoClose: 4 * 1000 });
      }
      return JumpResult.NoTargetsFound;
    }

    if (!result.file) {
      return JumpResult.NoTargetsFound;
    }

    this.console.log(
      '[KernelJedi] Opening:',
      result.file,
      'at line',
      result.line
    );

    // Convert absolute path to path relative to JupyterLab server root
    let filePath = result.file;
    this.console.log(`[KernelJedi] Original file path: ${filePath}`);

    // Get kernel's current working directory
    this.console.log('[KernelJedi] Getting kernel working directory...');
    const cwdCode = 'import os; print(os.getcwd())';
    const cwdFuture = kernel.requestExecute({ code: cwdCode });
    let kernelCwd = '';

    cwdFuture.onIOPub = (msg: KernelMessage.IIOPubMessage) => {
      if (msg.header.msg_type === 'stream') {
        const content = msg.content as KernelMessage.IStreamMsg['content'];
        if (content.name === 'stdout') {
          kernelCwd += content.text;
        }
      }
    };

    await cwdFuture.done;
    kernelCwd = kernelCwd.trim();
    this.console.log(`[KernelJedi] Kernel cwd: ${kernelCwd}`);

    // Calculate server root from notebook path
    const notebookDir = notebookPath.substring(
      0,
      notebookPath.lastIndexOf('/')
    );
    this.console.log(`[KernelJedi] Notebook dir: ${notebookDir}`);
    let serverRoot = kernelCwd;
    if (kernelCwd.endsWith(notebookDir)) {
      serverRoot = kernelCwd.substring(
        0,
        kernelCwd.length - notebookDir.length
      );
    }
    this.console.log(`[KernelJedi] Calculated server root: ${serverRoot}`);

    // Strip server root from definition file path
    if (filePath.startsWith(serverRoot)) {
      filePath = filePath.substring(serverRoot.length);
      if (filePath.startsWith('/')) {
        filePath = filePath.substring(1);
      }
    }
    this.console.log(`[KernelJedi] Resolved file path: ${filePath}`);

    // Try to open the file directly
    this.console.log(`[KernelJedi] Attempting to open file: ${filePath}`);
    try {
      const widget = await documentManager.openOrReveal(filePath);
      this.console.log('[KernelJedi] File opened successfully');
      if (widget && result.line) {
        setTimeout(() => {
          const content = widget.content as any;
          if (content && content.editor) {
            this.console.log(
              `[KernelJedi] Setting cursor to line ${result.line! - 1}`
            );
            content.editor.setCursorPosition({
              line: result.line! - 1,
              column: 0
            });
            content.editor.focus();
          }
        }, 100);
      }
      return JumpResult.AssumeSuccess;
    } catch (err) {
      this.console.warn('[KernelJedi] Could not open file directly:', err);
    }

    // Try with symlink fallback
    const symlinkPath = URLExt.join('.lsp_symlink', filePath);
    this.console.log(
      `[KernelJedi] Trying symlink fallback: ${symlinkPath}`
    );
    try {
      const widget = await documentManager.openOrReveal(symlinkPath);
      this.console.log('[KernelJedi] File opened via symlink');
      if (widget && result.line) {
        setTimeout(() => {
          const content = widget.content as any;
          if (content && content.editor) {
            this.console.log(
              `[KernelJedi] Setting cursor to line ${result.line! - 1}`
            );
            content.editor.setCursorPosition({
              line: result.line! - 1,
              column: 0
            });
            content.editor.focus();
          }
        }, 100);
      }
      return JumpResult.AssumeSuccess;
    } catch (err) {
      this.console.warn('[KernelJedi] Could not open via symlink:', err);
      return JumpResult.PathResolutionFailure;
    }
  }

  private _trans: TranslationBundle;
  private _jumpers: Map<string, CodeJumper>;
  private _notebookTracker: INotebookTracker;
  private _documentManager: IDocumentManager;
}

export namespace NavigationFeature {
  export interface IOptions extends Feature.IOptions {
    settings: FeatureSettings<LSPJumpSettings>;
    trans: TranslationBundle;
    notebookTracker: INotebookTracker;
    documentManager: IDocumentManager;
    contextAssembler: ContextAssembler;
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
    IDocumentManager
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
      trans
    });
    featureManager.register(feature);

    app.commands.addCommand(CommandIDs.jumpToDefinition, {
      execute: async () => {
        const context = contextAssembler.getContext();
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
        const result = await feature.handleJump(
          targets,
          positionParams,
          adapter,
          document
        );

        // If LSP found no targets, try kernel-based Jedi fallback for Python notebooks
        if (result === JumpResult.NoTargetsFound) {
          const enableKernelFallback =
            settings.composite.enableKernelFallback !== false;
          const notebook = notebookTracker.currentWidget;
          if (
            enableKernelFallback &&
            notebook &&
            notebook.sessionContext.session?.kernel &&
            feature.isPythonNotebook(notebook)
          ) {
            console.log(
              '[LSP] LSP returned no targets, trying kernel Jedi fallback'
            );
            await feature.jumpWithKernelJedi(notebook, documentManager);
          }
        }
      },
      label: trans.__('Jump to definition'),
      icon: jumpToIcon,
      isEnabled: () => {
        const context = contextAssembler.getContext();
        if (!context) {
          console.debug('Could not get context');
          return false;
        }
        const { connection } = context;
        return connection ? connection.provides('definitionProvider') : false;
      }
    });

    app.commands.addCommand(CommandIDs.jumpToReference, {
      execute: async () => {
        const context = contextAssembler.getContext();
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
        await feature.handleJump(targets, positionParams, adapter, document);
      },
      label: trans.__('Jump to references'),
      icon: jumpToIcon,
      isEnabled: () => {
        const context = contextAssembler.getContext();
        if (!context) {
          console.debug('Could not get context');
          return false;
        }
        const { connection } = context;
        return connection ? connection.provides('referencesProvider') : false;
      }
    });

    app.commands.addCommand(CommandIDs.jumpBack, {
      execute: async () => {
        const context = contextAssembler.getContext();
        if (!context) {
          console.warn('Could not get context');
          return;
        }
        feature.getJumper(context.adapter).globalJumpBack();
      },
      label: trans.__('Jump back'),
      icon: jumpBackIcon,
      isEnabled: () => {
        const context = contextAssembler.getContext();
        if (!context) {
          console.debug('Could not get context');
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
