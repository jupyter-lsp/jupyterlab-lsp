export import CodeMirror = require('codemirror');
import {
  CodeMirrorAdapter,
  ILspConnection,
  ITextEditorOptions
} from 'lsp-editor-adapter';
import * as lsProtocol from 'vscode-languageserver-protocol';
import { FreeTooltip } from '../free_tooltip';
import { getModifierState } from '../utils';
import { NotebookAsSingleEditor } from '../notebook_mapper';
import { PositionConverter } from '../converter';
import { diagnosticSeverityNames } from '../lsp';
// TODO: settings
const hover_modifier = 'Control';

export class CodeMirrorAdapterExtension extends CodeMirrorAdapter {
  private marked_diagnostics: Map<string, CodeMirror.TextMarker> = new Map();
  protected create_tooltip: (
    markup: lsProtocol.MarkupContent,
    cm_editor: CodeMirror.Editor,
    position: CodeMirror.Position
  ) => FreeTooltip;
  private _tooltip: FreeTooltip;
  private show_next_tooltip: boolean;
  private last_hover_response: lsProtocol.Hover;
  private last_hover_character: CodeMirror.Position;

  constructor(
    connection: ILspConnection,
    options: ITextEditorOptions,
    editor: CodeMirror.Editor,
    create_tooltip: (
      markup: lsProtocol.MarkupContent,
      cm_editor: CodeMirror.Editor,
      position: CodeMirror.Position
    ) => FreeTooltip
  ) {
    super(connection, options, editor);
    this.create_tooltip = create_tooltip;

    // @ts-ignore
    let listeners = this.editorListeners;

    let wrapper = this.editor.getWrapperElement();
    // detach the adapters contextmenu
    wrapper.removeEventListener('contextmenu', listeners.contextmenu);

    // show hover after pressing the modifier key
    wrapper.addEventListener('keydown', (event: KeyboardEvent) => {
      if (
        (!hover_modifier || getModifierState(event, hover_modifier)) &&
        this.hover_character === this.last_hover_character
      ) {
        this.show_next_tooltip = true;
        this.handleHover(this.last_hover_response);
      }
    });

    wrapper.addEventListener('keyup', () => {
      // TODO: the updates frequency and triggers will require a review and a clean up
      this.connection.sendChange();
    });
  }

  get hover_character() {
    // @ts-ignore
    return this.hoverCharacter;
  }

  public handleGoTo(locations: any) {
    this.remove_tooltip();

    // do NOT handle GoTo actions here
  }

  public handleCompletion(completions: lsProtocol.CompletionItem[]) {
    // do NOT handle completion here
    // TODO: UNLESS the trigger character was typed!
  }

  protected static get_markup(
    response: lsProtocol.Hover
  ): lsProtocol.MarkupContent {
    let contents = response.contents;

    // this causes the webpack to fail "Module not found: Error: Can't resolve 'net'" for some reason
    // if (lsProtocol.MarkedString.is(contents))
    ///  contents = [contents];

    if (typeof contents === 'string') {
      contents = [contents as lsProtocol.MarkedString];
    }

    if (!Array.isArray(contents)) { return contents as lsProtocol.MarkupContent; }

    // now we have MarkedString
    let content = contents[0];

    if (typeof content === 'string') {
      // coerce to MarkedString  object
      return {
        kind: 'plaintext',
        value: content
      };
    } else {
      return {
        kind: 'markdown',
        value: '```' + content.language + '\n' + content.value + '```'
      };
    }
  }

  protected remove_tooltip() {
    // @ts-ignore
    this._removeHover(); // this removes underlines

    if (this._tooltip !== undefined) { this._tooltip.dispose(); }
  }

  public handleHover(response: lsProtocol.Hover) {
    this.remove_tooltip();

    if (
      !response ||
      !response.contents ||
      (Array.isArray(response.contents) && response.contents.length === 0)
    ) {
      return;
    }

    this.highlight_range(response.range, 'cm-lp-hover-available');

    this.last_hover_response = null;
    if (!this.show_next_tooltip) {
      this.last_hover_response = response;
      this.last_hover_character = this.hover_character;
      return;
    }

    const markup = CodeMirrorAdapterExtension.get_markup(response);
    let position = this.hover_character;
    // TODO this is where the idea of mapping notebooks with an object pretending to be an editor has a weak side...

    let cm_editor = this.editor;
    if ((cm_editor as NotebookAsSingleEditor).get_editor_at !== undefined) {
      cm_editor = (cm_editor as NotebookAsSingleEditor).get_editor_at(
        position as CodeMirror.Position
      );
    }

    this._tooltip = this.create_tooltip(markup, cm_editor, position);
  }

  protected highlight_range(range: lsProtocol.Range, class_name: string) {
    let hover_character = this.hover_character as CodeMirror.Position;

    let start: CodeMirror.Position;
    let end: CodeMirror.Position;

    if (range) {
      start = PositionConverter.lsp_to_cm(range.start);
      end = PositionConverter.lsp_to_cm(range.end);
    } else {
      // construct range manually using the token information
      let token = this.editor.getTokenAt(hover_character);
      start = { line: hover_character.line, ch: token.start };
      end = { line: hover_character.line, ch: token.end };
    }

    // @ts-ignore
    this.hoverMarker = this.editor.getDoc().markText(start, end, {
      className: class_name
    });
  }

  public handleMouseOver(event: MouseEvent) {
    // proceed when no hover modifier or hover modifier pressed
    this.show_next_tooltip =
      !hover_modifier || getModifierState(event, hover_modifier);

    return super.handleMouseOver(event);
  }

  public handleDiagnostic(response: lsProtocol.PublishDiagnosticsParams) {
    /*
    TODO: the base class has the gutter support, like this
    this.editor.clearGutter('CodeMirror-lsp');
     */

    // Note: no deep equal for Sets or Maps in JS:
    // https://stackoverflow.com/a/29759699
    const markers_to_retain: Set<string> = new Set<string>();

    // add new markers, keep track of the added ones
    let doc = this.editor.getDoc();

    let transform: (position: CodeMirror.Position) => CodeMirror.Position;
    let get_cell_id: (position: CodeMirror.Position) => string;

    const notebook_as_editor = this.editor as NotebookAsSingleEditor;

    // duck typing: does it implement transform and get_cell_at?
    if (
      notebook_as_editor.transform !== undefined &&
      notebook_as_editor.get_cell_at !== undefined
    ) {
      transform = position => notebook_as_editor.transform(position);
      get_cell_id = position => notebook_as_editor.get_cell_at(position).id;
    } else {
      transform = position => position;
      get_cell_id = position => '';
    }

    response.diagnostics.forEach((diagnostic: lsProtocol.Diagnostic) => {
      const start = PositionConverter.lsp_to_cm(diagnostic.range.start);
      const end = PositionConverter.lsp_to_cm(diagnostic.range.end);

      const severity = diagnosticSeverityNames[diagnostic.severity];

      // what a pity there is no hash in the standard library...
      // we could use this: https://stackoverflow.com/a/7616484 though it may not be worth it:
      //   the stringified diagnostic objects are only about 100-200 JS characters anyway,
      //   depending on the message length; this could be reduced using some structure-aware
      //   stringifier; such a stringifier could also prevent the possibility of having a false
      //   negative due to a different ordering of keys
      // obviously, the hash would prevent recovery of info from the key.
      let diagnostic_hash = JSON.stringify({
        ...diagnostic,
        // the apparent marker position will change in the notebook with every line change for each marker
        // after the (inserted/removed) line - but such markers should not be invalidated,
        // i.e. the invalidation should be performed in the cell space, not in the notebook coordinate space,
        // thus we transform the coordinates and keep the cell id in the hash
        range: {
          start: transform(start),
          end: transform(end)
        },
        cell: get_cell_id(start)
      });
      markers_to_retain.add(diagnostic_hash);

      if (!this.marked_diagnostics.has(diagnostic_hash)) {
        let options: CodeMirror.TextMarkerOptions = {
          title:
            diagnostic.message +
            (diagnostic.source ? ' (' + diagnostic.source + ')' : ''),
          className: 'cm-lsp-diagnostic cm-lsp-diagnostic-' + severity
        };
        let marker;
        try {
          marker = doc.markText(start, end, options);
        } catch (e) {
          console.warn(
            'Marking inspection (diagnostic text) failed, see following logs (2):'
          );
          console.log(diagnostic);
          console.log(e);
          return;
        }
        this.marked_diagnostics.set(diagnostic_hash, marker);
      }

      /*
      TODO and this:
        const childEl = document.createElement('div');
        childEl.classList.add('CodeMirror-lsp-guttermarker');
        childEl.title = diagnostic.message;
        this.editor.setGutterMarker(start.line, 'CodeMirror-lsp', childEl);
      do we want gutters?
     */
    });

    // remove the markers which were not included in the new message
    this.marked_diagnostics.forEach(
      (marker: CodeMirror.TextMarker, diagnostic_hash: string) => {
        if (!markers_to_retain.has(diagnostic_hash)) {
          this.marked_diagnostics.delete(diagnostic_hash);
          marker.clear();
        }
      }
    );
  }
}
