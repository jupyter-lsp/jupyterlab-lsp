import * as lsProtocol from 'vscode-languageserver-protocol';
import { IRootPosition } from '../../../positioning';
import * as CodeMirror from 'codemirror';
import { CodeMirrorLSPFeature } from '../feature';

export class Signature extends CodeMirrorLSPFeature {
  name = 'Signature';
  protected signature_character: IRootPosition;
  protected _signatureCharacters: string[];

  register(): void {
    this.connection_handlers.set('signature', this.handleSignature.bind(this));
    super.register();
  }

  protected get_markup_for_signature_help(
    response: lsProtocol.SignatureHelp,
    language: string
  ): lsProtocol.MarkupContent {
    let signatures = new Array<string>();

    response.signatures.forEach(item => {
      let markdown = this.markdown_from_signature(item, language);
      signatures.push(markdown);
    });

    return {
      kind: 'markdown',
      value: signatures.join('\n\n')
    };
  }

  /**
   * A temporary workaround for the LSP servers returning plain text (e.g. docstrings)
   * (providing not-the-best UX) instead of markdown and me being unable to force
   * them to return markdown instead.
   */
  private markdown_from_signature(
    item: lsProtocol.SignatureInformation,
    language: string
  ): string {
    let markdown = '```' + language + '\n' + item.label + '\n```';
    if (item.documentation) {
      markdown += '\n';

      let in_text_block = false;
      // TODO: make use of the MarkupContent object instead
      for (let line of item.documentation.toString().split('\n')) {
        if (line.trim() === item.label.trim()) {
          continue;
        }

        if (line.startsWith('>>>')) {
          if (in_text_block) {
            markdown += '```\n\n';
            in_text_block = false;
          }
          line = '```' + language + '\n' + line.substr(3) + '\n```';
        } else {
          // start new text block
          if (!in_text_block) {
            markdown += '```\n';
            in_text_block = true;
          }
        }
        markdown += line + '\n';
      }
      // close off the text block - if any
      if (in_text_block) {
        markdown += '```';
      }
    }
    return markdown;
  }

  private handleSignature(response: lsProtocol.SignatureHelp) {
    this.jupyterlab_components.remove_tooltip();

    if (!this.signature_character || !response || !response.signatures.length) {
      return;
    }

    let root_position = this.signature_character;
    let cm_editor = this.get_cm_editor(root_position);
    let editor_position = this.virtual_editor.root_position_to_editor(
      root_position
    );
    let language = this.get_language_at(editor_position, cm_editor);
    let markup = this.get_markup_for_signature_help(response, language);

    this.jupyterlab_components.create_tooltip(
      markup,
      cm_editor,
      editor_position
    );
  }

  get signatureCharacters() {
    if (
      typeof this._signatureCharacters === 'undefined' ||
      !this._signatureCharacters.length
    ) {
      this._signatureCharacters = this.connection.getLanguageSignatureCharacters();
    }
    return this._signatureCharacters;
  }

  afterChange(
    change: CodeMirror.EditorChange,
    root_position: IRootPosition
  ): void {
    let last_character = this.extract_last_character(change);
    if (this.signatureCharacters.indexOf(last_character) > -1) {
      this.signature_character = root_position;
      let virtual_position = this.virtual_editor.root_position_to_virtual_position(
        root_position
      );
      this.connection.getSignatureHelp(virtual_position);
    }
  }
}
