import { Language } from '@codemirror/language';
import { ChangeSet, Text } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  EditorExtensionRegistry,
  IEditorLanguageRegistry,
  jupyterHighlightStyle
} from '@jupyterlab/codemirror';
import {
  IEditorPosition,
  IRootPosition,
  offsetAtPosition,
  positionAtOffset,
  ILSPFeatureManager,
  ILSPDocumentConnectionManager,
  WidgetLSPAdapter
} from '@jupyterlab/lsp';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { highlightTree } from '@lezer/highlight';
import * as lsProtocol from 'vscode-languageserver-protocol';

import { CodeSignature as LSPSignatureSettings } from '../_signature';
import { EditorTooltipManager } from '../components/free_tooltip';
import {
  PositionConverter,
  rootPositionToVirtualPosition,
  editorPositionToRootPosition
} from '../converter';
import { FeatureSettings, Feature } from '../feature';
import { ILogConsoleCore, PLUGIN_ID } from '../tokens';
import { escapeMarkdown } from '../utils';
import { BrowserConsole } from '../virtual/console';

const TOOLTIP_ID = 'signature';
const CLASS_NAME = 'lsp-signature-help';

function getMarkdown(item: string | lsProtocol.MarkupContent) {
  if (typeof item === 'string') {
    return escapeMarkdown(item);
  } else {
    if (item.kind === 'markdown') {
      return item.value;
    } else {
      return escapeMarkdown(item.value);
    }
  }
}

interface ISplit {
  lead: string;
  remainder: string;
}

export function extractLead(lines: string[], size: number): ISplit | null {
  // try to split after paragraph
  const leadLines = [];
  let splitOnParagraph = false;

  for (const line of lines.slice(0, size + 1)) {
    const isEmpty = line.trim() == '';
    if (isEmpty) {
      splitOnParagraph = true;
      break;
    }
    leadLines.push(line);
  }
  // see if we got something which does not include Markdown formatting
  // (so it won't lead to broken formatting if we split after it);
  const leadCandidate = leadLines.join('\n');

  if (splitOnParagraph && leadCandidate.search(/[\\*#[\]<>_]/g) === -1) {
    return {
      lead: leadCandidate,
      remainder: lines.slice(leadLines.length + 1).join('\n')
    };
  }
  return null;
}

/**
 * Represent signature as a Markdown element.
 */
export function signatureToMarkdown(
  item: lsProtocol.SignatureInformation,
  language: Language | undefined,
  codeHighlighter: (
    source: string,
    variable: lsProtocol.ParameterInformation,
    language: Language | undefined
  ) => string,
  logger: ILogConsoleCore,
  activeParameterFallback?: number | null,
  maxLinesBeforeCollapse: number = 4
): string {
  const activeParameter: number | undefined | null =
    typeof item.activeParameter !== 'undefined'
      ? item.activeParameter
      : activeParameterFallback;
  let markdown: string;
  let label = item.label;
  if (item.parameters && activeParameter != null) {
    if (activeParameter > item.parameters.length) {
      logger.error(
        'LSP server returned wrong number for activeSignature for: ',
        item
      );
      markdown = '```' + language?.name + '\n' + label + '\n```';
    } else {
      const parameter = item.parameters[activeParameter];
      markdown = codeHighlighter(label, parameter, language);
    }
  } else {
    markdown = '```' + language?.name + '\n' + label + '\n```';
  }
  let details = '';
  if (item.documentation) {
    if (
      typeof item.documentation === 'string' ||
      item.documentation.kind === 'plaintext'
    ) {
      const plainTextDocumentation =
        typeof item.documentation === 'string'
          ? item.documentation
          : item.documentation.value;
      // TODO: make use of the MarkupContent object instead
      for (let line of plainTextDocumentation.split('\n')) {
        if (line.trim() === item.label.trim()) {
          continue;
        }

        details += getMarkdown(line) + '\n';
      }
    } else {
      if (item.documentation.kind !== 'markdown') {
        logger.warn('Unknown MarkupContent kind:', item.documentation.kind);
      }
      details += item.documentation.value;
    }
  } else if (item.parameters) {
    details +=
      '\n\n' +
      item.parameters
        .filter(parameter => parameter.documentation)
        .map(parameter => '- ' + getMarkdown(parameter.documentation!))
        .join('\n');
  }
  if (details) {
    const lines = details.trim().split('\n');
    if (lines.length > maxLinesBeforeCollapse) {
      const split = extractLead(lines, maxLinesBeforeCollapse);
      if (split) {
        details =
          split.lead + '\n<details>\n' + split.remainder + '\n</details>';
      } else {
        details = '<details>\n' + details + '\n</details>';
      }
    }
    markdown += '\n\n' + details;
  } else {
    markdown += '\n';
  }
  return markdown;
}

export function highlightCode(
  source: string,
  parameter: lsProtocol.ParameterInformation,
  language: Language | undefined
) {
  const pre = document.createElement('pre');
  const code = document.createElement('code');
  pre.appendChild(code);
  code.className =
    'cm-s-jupyter' + language ? `language-${language?.name}` : '';

  const substring: string =
    typeof parameter.label === 'string'
      ? parameter.label
      : source.slice(parameter.label[0], parameter.label[1]);
  const start = source.indexOf(substring);
  const end = start + substring.length;
  if (!language) {
    code.innerText = source;
  } else {
    runMode(
      source,
      language,
      (token: string, className: string, from: number, to: number) => {
        let populated = false;
        // In CodeMirror6 variables are not necessarily tokenized,
        // we need to split them manually
        if (from <= end && start <= to) {
          const a = Math.max(start, from);
          const b = Math.min(to, end);
          if (a != b) {
            const prefix = source.slice(from, a);
            const content = source.slice(a, b);
            const suffix = source.slice(b, to);

            const mark = document.createElement('mark');
            if (className) {
              mark.className = className;
            }
            mark.appendChild(document.createTextNode(content));
            code.appendChild(document.createTextNode(prefix));
            code.appendChild(mark);
            code.appendChild(document.createTextNode(suffix));
            populated = true;
          }
        }
        if (!populated) {
          if (className) {
            const element = document.createElement('span');
            element.classList.add(className);
            element.textContent = token;
            code.appendChild(element);
          } else {
            code.appendChild(document.createTextNode(token));
          }
        }
      }
    );
  }

  return pre.outerHTML;
}

function extractLastCharacter(changes: ChangeSet): string {
  // TODO test with pasting, maybe rewrite to retrieve based on cursor position.
  let last = '';
  changes.iterChanges(
    (
      fromA: number,
      toA: number,
      fromB: number,
      toB: number,
      inserted: Text
    ) => {
      last = inserted.sliceString(-1);
    }
  );
  return last ? last[0] : '';
}

function runMode(
  source: string,
  language: Language,
  callback: (
    text: string,
    style: string | null,
    from: number,
    to: number
  ) => void
): void {
  const tree = language.parser.parse(source);
  let pos = 0;
  highlightTree(tree, jupyterHighlightStyle, (from, to, token) => {
    if (from > pos) {
      callback(source.slice(pos, from), null, pos, from);
    }
    callback(source.slice(from, to), token, from, to);
    pos = to;
  });
  if (pos != tree.length) {
    callback(source.slice(pos, tree.length), null, pos, tree.length);
  }
}

export class SignatureFeature extends Feature {
  readonly id = SignatureFeature.id;
  readonly capabilities: lsProtocol.ClientCapabilities = {
    textDocument: {
      signatureHelp: {
        dynamicRegistration: true,
        signatureInformation: {
          documentationFormat: ['markdown', 'plaintext']
        }
      }
    }
  };
  tooltip: EditorTooltipManager;

  protected signatureCharacter: IRootPosition;
  protected _signatureCharacters: string[];
  protected console = new BrowserConsole().scope('Signature');
  protected settings: FeatureSettings<LSPSignatureSettings>;
  protected languageRegistry: IEditorLanguageRegistry;

  constructor(options: SignatureFeature.IOptions) {
    super(options);
    this.settings = options.settings;
    this.tooltip = new EditorTooltipManager(options.renderMimeRegistry);
    this.languageRegistry = options.languageRegistry;
    this.extensionFactory = {
      name: 'lsp:codeSignature',
      factory: factoryOptions => {
        const { editor: editorAccessor, widgetAdapter: adapter } =
          factoryOptions;

        const updateListener = EditorView.updateListener.of(viewUpdate => {
          const editor = editorAccessor!.getEditor();

          if (!editor) {
            // see https://github.com/jupyter-lsp/jupyterlab-lsp/issues/984
            // TODO: should not be needed once https://github.com/jupyterlab/jupyterlab/pull/14920 is in
            return;
          }

          // TODO: or should it come from viewUpdate instead?!
          // especially on copy paste this can be problematic.
          const position = editor.getCursorPosition();

          const editorPosition = PositionConverter.ce_to_cm(
            position
          ) as IEditorPosition;

          // Delay handling by moving on top of the stack
          // so that virtual document is updated.
          setTimeout(() => {
            // be careful: updateListener also fires after blur, so we
            // need to carefully check what changed to avoid invalidating
            // user clicking on the hover box.
            if (viewUpdate.docChanged) {
              this.afterChange(
                viewUpdate.changes,
                adapter,
                editorPosition
              ).catch(this.console.warn);
            } else if (viewUpdate.selectionSet) {
              this.onCursorActivity(adapter, editorPosition).catch(
                this.console.warn
              );
            }
          }, 0);
        });

        const focusListener = EditorView.domEventHandlers({
          focus: () => {
            // TODO
            // this.onCursorActivity()
          },
          blur: event => {
            this.onBlur(event);
          }
        });

        return EditorExtensionRegistry.createImmutableExtension([
          updateListener,
          focusListener
        ]);
      }
    };
  }

  get _closeCharacters(): string[] {
    if (!this.settings) {
      return [];
    }
    return this.settings.composite.closeCharacters;
  }

  onBlur(event: FocusEvent) {
    // hide unless the focus moved to the signature itself
    // (allowing user to select/copy from signature)
    const target = event.relatedTarget as Element | null;
    if (
      this.isSignatureShown() &&
      (target ? target.closest('.' + CLASS_NAME) === null : true)
    ) {
      this._removeTooltip();
    }
  }

  async onCursorActivity(
    adapter: WidgetLSPAdapter<any>,
    newEditorPosition: IEditorPosition
  ) {
    if (!this.isSignatureShown()) {
      return;
    }

    const initialPosition = this.tooltip.position;
    if (
      newEditorPosition.line === initialPosition.line &&
      newEditorPosition.ch < initialPosition.ch
    ) {
      // close tooltip if receded beyond starting position
      this._removeTooltip();
    } else {
      // otherwise, update the signature as the active parameter could have changed,
      // or the server may want us to close the tooltip
      await this._requestSignature(adapter, newEditorPosition, initialPosition);
    }
  }

  protected getMarkupForSignatureHelp(
    response: lsProtocol.SignatureHelp,
    language: Language | undefined
  ): lsProtocol.MarkupContent {
    let signatures = new Array<string>();

    if (response.activeSignature != null) {
      if (response.activeSignature >= response.signatures.length) {
        this.console.error(
          'LSP server returned wrong number for activeSignature for: ',
          response
        );
      } else {
        const item = response.signatures[response.activeSignature];
        return {
          kind: 'markdown',
          value: this.signatureToMarkdown(
            item,
            language,
            response.activeParameter
          )
        };
      }
    }

    response.signatures.forEach(item => {
      let markdown = this.signatureToMarkdown(item, language);
      signatures.push(markdown);
    });

    return {
      kind: 'markdown',
      value: signatures.join('\n\n')
    };
  }

  /**
   * Represent signature as a Markdown element.
   */
  protected signatureToMarkdown(
    item: lsProtocol.SignatureInformation,
    language: Language | undefined,
    activeParameterFallback?: number | null
  ): string {
    return signatureToMarkdown(
      item,
      language,
      highlightCode,
      this.console,
      activeParameterFallback,
      this.settings.composite.maxLines
    );
  }

  private _removeTooltip() {
    this.tooltip.remove();
  }

  private _hideTooltip() {
    this.tooltip.hide();
  }

  private handleSignature(
    response: lsProtocol.SignatureHelp,
    adapter: WidgetLSPAdapter<any>,
    positionAtRequest: IRootPosition,
    displayPosition: IEditorPosition | null = null
  ) {
    this.console.debug('Signature received', response);

    // TODO: this might wrong connection!
    // we need to find the correct documentAtRootPosition
    const virtualDocument = adapter.virtualDocument!;
    const connection = this.connectionManager.connections.get(
      virtualDocument.uri
    )!;

    const signatureCharacters: string[] =
      connection.serverCapabilities.signatureHelpProvider?.triggerCharacters ??
      [];

    if (response === null) {
      // do not hide on undefined as it simply indicates that no new info is available
      // (null means close, undefined means no update, response means update)
      this._removeTooltip();
    } else if (response) {
      this._hideTooltip();
    }

    if (!this.signatureCharacter || !response || !response.signatures.length) {
      if (response) {
        this._removeTooltip();
      }
      this.console.debug(
        'Ignoring signature response: cursor lost or response empty'
      );
      return;
    }

    // TODO: helper?
    const editorAccessor = adapter.activeEditor!;
    const editor = editorAccessor.getEditor()!;
    const pos = editor.getCursorPosition();
    const editorPosition = PositionConverter.ce_to_cm(pos) as IEditorPosition;

    // TODO should I just shove it into Feature class and have an adapter getter in there?
    const rootPosition = editorPositionToRootPosition(
      adapter,
      editorAccessor,
      editorPosition
    );

    if (!rootPosition) {
      this.console.warn(
        'Signature failed: could not map editor position to root position.'
      );
      this._removeTooltip();
      return;
    }

    // if the cursor advanced in the same line, the previously retrieved signature may still be useful
    // if the line changed or cursor moved backwards then no reason to keep the suggestions
    if (
      positionAtRequest.line != rootPosition.line ||
      rootPosition.ch < positionAtRequest.ch
    ) {
      this.console.debug(
        'Ignoring signature response: cursor has receded or changed line'
      );
      this._removeTooltip();
      return;
    }

    //const virtualPosition = rootPositionToVirtualPosition(adapter, rootPosition);

    //let editorAccessor = adapter.editors[adapter.getEditorIndexAt(virtualPosition)].ceEditor;
    //const editor = editorAccessor.getEditor();
    if (!editor) {
      this.console.debug(
        'Ignoring signature response: the corresponding editor is not loaded'
      );
      return;
    }
    if (!editor.hasFocus()) {
      this.console.debug(
        'Ignoring signature response: the corresponding editor lost focus'
      );
      this._removeTooltip();
      return;
    }

    const editorLanguage = this.languageRegistry.findByMIME(
      editor.model.mimeType
    );
    const language = editorLanguage?.support?.language;
    let markup = this.getMarkupForSignatureHelp(response, language);

    this.console.debug(
      'Signature will be shown',
      language,
      markup,
      rootPosition,
      response
    );
    if (displayPosition === null) {
      // try to find last occurrence of trigger character to position the tooltip
      const content = editor.model.sharedModel.getSource();
      const lines = content.split('\n');
      const offset = offsetAtPosition(
        PositionConverter.cm_to_ce(editorPosition!),
        lines
      );
      // maybe?
      // const offset = cm_editor.getOffsetAt(PositionConverter.cm_to_ce(editorPosition));
      const subset = content.substring(0, offset);
      const lastTriggerCharacterOffset = Math.max(
        ...signatureCharacters.map(character => subset.lastIndexOf(character))
      );
      if (lastTriggerCharacterOffset !== -1) {
        displayPosition = PositionConverter.ce_to_cm(
          positionAtOffset(lastTriggerCharacterOffset, lines)
        ) as IEditorPosition;
      } else {
        displayPosition = editorPosition;
      }
    }
    this.tooltip.showOrCreate({
      markup,
      position: displayPosition!,
      id: TOOLTIP_ID,
      ceEditor: editor,
      adapter: adapter,
      className: CLASS_NAME,
      tooltip: {
        privilege: 'forceAbove',
        // do not move the tooltip to match the token to avoid drift of the
        // tooltip due the simplicity of token matching rules; instead we keep
        // the position constant manually via `displayPosition`.
        alignment: undefined,
        hideOnKeyPress: false
      }
    });
  }

  protected isSignatureShown() {
    return this.tooltip.isShown(TOOLTIP_ID);
  }

  async afterChange(
    change: ChangeSet,
    adapter: WidgetLSPAdapter<any>,
    editorPosition: IEditorPosition
  ) {
    const lastCharacter = extractLastCharacter(change);

    const isSignatureShown = this.isSignatureShown();
    let previousPosition: IEditorPosition | null = null;
    await adapter.updateFinished;

    if (isSignatureShown) {
      previousPosition = this.tooltip.position;
      if (this._closeCharacters.includes(lastCharacter)) {
        // remove just in case but do not short-circuit in case if we need to re-trigger
        this._removeTooltip();
      }
    }

    // TODO: use connection for virtual document from root position!
    const virtualDocument = adapter.virtualDocument;
    if (!virtualDocument) {
      this.console.warn('Could not access virtual document');
      return;
    }
    const connection = this.connectionManager.connections.get(
      virtualDocument.uri
    )!;
    if (!connection.isReady) {
      return;
    }

    const signatureCharacters =
      connection.serverCapabilities.signatureHelpProvider?.triggerCharacters ??
      [];

    // only proceed if: trigger character was used or the signature is/was visible immediately before
    if (!(signatureCharacters.includes(lastCharacter) || isSignatureShown)) {
      return;
    }

    await this._requestSignature(adapter, editorPosition, previousPosition);
  }

  private async _requestSignature(
    adapter: WidgetLSPAdapter<any>,
    newEditorPosition: IEditorPosition,
    previousPosition: IEditorPosition | null
  ) {
    // TODO: why would virtual document be missing?
    const virtualDocument = adapter.virtualDocument!;
    const connection = this.connectionManager.connections.get(
      virtualDocument.uri
    )!;

    if (
      !(
        connection.isReady &&
        connection.serverCapabilities.signatureHelpProvider
      )
    ) {
      return;
    }

    // TODO: why missing
    const rootPosition = virtualDocument.transformFromEditorToRoot(
      adapter.activeEditor!,
      newEditorPosition
    )!;

    this.signatureCharacter = rootPosition;

    const virtualPosition = rootPositionToVirtualPosition(
      adapter,
      rootPosition
    );

    const help = await connection.clientRequests[
      'textDocument/signatureHelp'
    ].request({
      position: {
        line: virtualPosition.line,
        character: virtualPosition.ch
      },
      textDocument: {
        uri: virtualDocument.documentInfo.uri
      }
    });
    return this.handleSignature(help, adapter, rootPosition, previousPosition);
  }
}

export namespace SignatureFeature {
  export interface IOptions extends Feature.IOptions {
    settings: FeatureSettings<LSPSignatureSettings>;
    renderMimeRegistry: IRenderMimeRegistry;
    languageRegistry: IEditorLanguageRegistry;
  }
  export const id = PLUGIN_ID + ':signature';
}

export const SIGNATURE_PLUGIN: JupyterFrontEndPlugin<void> = {
  id: SignatureFeature.id,
  requires: [
    ILSPFeatureManager,
    ISettingRegistry,
    IRenderMimeRegistry,
    ILSPDocumentConnectionManager,
    IEditorLanguageRegistry
  ],
  autoStart: true,
  activate: async (
    app: JupyterFrontEnd,
    featureManager: ILSPFeatureManager,
    settingRegistry: ISettingRegistry,
    renderMimeRegistry: IRenderMimeRegistry,
    connectionManager: ILSPDocumentConnectionManager,
    languageRegistry: IEditorLanguageRegistry
  ) => {
    const settings = new FeatureSettings<LSPSignatureSettings>(
      settingRegistry,
      SignatureFeature.id
    );
    await settings.ready;
    if (settings.composite.disable) {
      return;
    }
    const feature = new SignatureFeature({
      settings,
      connectionManager,
      renderMimeRegistry,
      languageRegistry
    });
    featureManager.register(feature);
    // return feature;
  }
};
