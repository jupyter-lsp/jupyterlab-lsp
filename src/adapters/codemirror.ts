export import CodeMirror = require('codemirror');
import {
  CodeMirrorAdapter,
  ILspConnection,
  ITextEditorOptions
} from 'lsp-editor-adapter';
import * as lsProtocol from 'vscode-languageserver-protocol';
import { FreeTooltip } from '../free_tooltip';
import { DefaultMap, getModifierState } from '../utils';
import { PositionConverter } from '../converter';
import { diagnosticSeverityNames } from '../lsp';
import { VirtualEditor } from '../virtual/editor';
import { VirtualDocument } from '../virtual/document';
import {
  IEditorPosition,
  is_equal,
  IRootPosition,
  IVirtualPosition
} from '../positioning';

export type KeyModifier = 'Alt' | 'Control' | 'Shift' | 'Meta' | 'AltGraph';
// TODO: settings
const hover_modifier: KeyModifier = 'Control';
const default_severity = 2;

export class CodeMirrorAdapterExtension extends CodeMirrorAdapter {
  private marked_diagnostics: Map<string, CodeMirror.TextMarker> = new Map();
  protected create_tooltip: (
    markup: lsProtocol.MarkupContent,
    cm_editor: CodeMirror.Editor,
    position: IEditorPosition
  ) => FreeTooltip;
  private _tooltip: FreeTooltip;
  private show_next_tooltip: boolean;
  private last_hover_response: lsProtocol.Hover;
  private last_hover_character: CodeMirror.Position;
  editor: VirtualEditor;

  invoke_completer: Function;
  private unique_editor_ids: DefaultMap<CodeMirror.Editor, number>;
  private signature_character: IRootPosition;

  constructor(
    connection: ILspConnection,
    options: ITextEditorOptions,
    editor: VirtualEditor,
    create_tooltip: (
      markup: lsProtocol.MarkupContent,
      cm_editor: CodeMirror.Editor,
      position: IEditorPosition
    ) => FreeTooltip,
    invoke_completer: Function,
    private virtual_document: VirtualDocument
  ) {
    super(connection, options, editor);
    this.create_tooltip = create_tooltip;
    this.invoke_completer = invoke_completer;
    this.unique_editor_ids = new DefaultMap(() => this.unique_editor_ids.size);

    // @ts-ignore
    let listeners = this.editorListeners;

    let wrapper = this.editor.getWrapperElement();
    this.editor.addEventListener(
      'mouseleave',
      // TODO: remove_tooltip() but allow the mouse to leave if it enters the tooltip
      //  (a bit tricky: normally we would just place the tooltip within, but it was designed to be attached to body)
      this.remove_range_highlight.bind(this)
    );
    wrapper.addEventListener(
      'mouseleave',
      this.remove_range_highlight.bind(this)
    );
    // detach the adapters contextmenu
    wrapper.removeEventListener('contextmenu', listeners.contextmenu);

    // TODO: actually we only need the connection...
    //  the tooltips and suggestions will need re-writing to JL standards anyway

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

  private _completionCharacters: string[];
  private _signatureCharacters: string[];

  get completionCharacters() {
    if (!this._completionCharacters.length) {
      this._completionCharacters = this.connection.getLanguageCompletionCharacters();
    }
    return this._completionCharacters;
  }

  get signatureCharacters() {
    if (!this._signatureCharacters.length) {
      this._signatureCharacters = this.connection.getLanguageSignatureCharacters();
    }
    return this._signatureCharacters;
  }

  protected hover_character: IRootPosition;

  public handleGoTo(locations: any) {
    this.remove_tooltip();

    // do NOT handle GoTo actions here
  }

  public handleCompletion(completions: lsProtocol.CompletionItem[]) {
    // do NOT handle completion here
  }

  protected static get_markup_for_hover(
    response: lsProtocol.Hover
  ): lsProtocol.MarkupContent {
    let contents = response.contents;

    // this causes the webpack to fail "Module not found: Error: Can't resolve 'net'" for some reason
    // if (lsProtocol.MarkedString.is(contents))
    ///  contents = [contents];

    if (typeof contents === 'string') {
      contents = [contents as lsProtocol.MarkedString];
    }

    if (!Array.isArray(contents)) {
      return contents as lsProtocol.MarkupContent;
    }

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

  protected remove_range_highlight() {
    // @ts-ignore
    this._removeHover(); // this removes underlines
    this.last_hover_character = null;
  }

  protected remove_tooltip() {
    this.remove_range_highlight();

    if (this._tooltip !== undefined) {
      this._tooltip.dispose();
    }
  }

  public handleHover(response: lsProtocol.Hover) {
    this.remove_tooltip();
    this.last_hover_character = null;
    this.last_hover_response = null;

    if (
      !this.hover_character ||
      !response ||
      !response.contents ||
      (Array.isArray(response.contents) && response.contents.length === 0)
    ) {
      return;
    }

    this.highlight_range(response.range, 'cm-lp-hover-available');

    if (!this.show_next_tooltip) {
      this.last_hover_response = response;
      this.last_hover_character = this.hover_character;
      return;
    }

    const markup = CodeMirrorAdapterExtension.get_markup_for_hover(response);
    let root_position = this.hover_character;
    let cm_editor = this.get_cm_editor(root_position);
    let editor_position = this.editor.root_position_to_editor_position(
      root_position
    );

    this._tooltip = this.create_tooltip(markup, cm_editor, editor_position);
  }

  get_cm_editor(position: IRootPosition) {
    return this.editor.get_cm_editor(position);
  }

  get_language_at(position: IEditorPosition, editor: CodeMirror.Editor) {
    return editor.getModeAt(position).name;
  }

  protected get_markup_for_signature_help(
    response: lsProtocol.SignatureHelp,
    language: string
  ): lsProtocol.MarkupContent {
    let signatures = new Array<string>();

    response.signatures.forEach((item: lsProtocol.SignatureInformation) => {
      let markdown = '```' + language + '\n' + item.label + '\n```';
      if (item.documentation) {
        markdown += '\n';
        // TODO: make use of the MarkupContent object instead
        for (let line of item.documentation.toString().split('\n')) {
          if (line.trim() === item.label.trim()) {
            continue;
          }
          if (line.startsWith('>>>')) {
            line = '```' + language + '\n' + line.substr(3) + '\n```';
          }
          markdown += line + '\n';
        }
      }
      signatures.push(markdown);
    });

    return {
      kind: 'markdown',
      value: signatures.join('\n\n')
    };
  }

  public handleSignature(response: lsProtocol.SignatureHelp) {
    this.remove_tooltip();

    if (!this.signature_character || !response || !response.signatures.length) {
      return;
    }

    let root_position = this.signature_character;
    let cm_editor = this.get_cm_editor(root_position);
    let editor_position = this.editor.root_position_to_editor_position(
      root_position
    );
    let language = this.get_language_at(editor_position, cm_editor);
    let markup = this.get_markup_for_signature_help(response, language);

    this._tooltip = this.create_tooltip(markup, cm_editor, editor_position);
  }

  public handleChange(cm: CodeMirror.Editor, change: CodeMirror.EditorChange) {
    this.remove_tooltip();

    const root_position = this.editor
      .getDoc()
      .getCursor('end') as IRootPosition;

    this.connection.sendChange();

    if (!change.text.length || !change.text[0].length) {
      // deletion - ignore
      return;
    }

    let last_character: string;

    if (change.origin === 'paste') {
      last_character = change.text[0][change.text.length - 1];
    } else {
      last_character = change.text[0][0];
    }

    if (this.completionCharacters.indexOf(last_character) > -1) {
      // TODO: pass info that we start from autocompletion (to avoid having . completion in comments etc)
      this.invoke_completer();
    } else if (this.signatureCharacters.indexOf(last_character) > -1) {
      this.signature_character = root_position;
      let virtual_position = this.editor.root_position_to_virtual_position(
        root_position
      );
      this.connection.getSignatureHelp(virtual_position);
    }
  }

  protected highlight_range(range: lsProtocol.Range, class_name: string) {
    let hover_character = this.hover_character;

    let start: IVirtualPosition;
    let end: IVirtualPosition;

    let start_in_editor: any;
    let end_in_editor: any;

    let cm_editor: any;
    // NOTE: foreign document ranges are checked before the request is sent,
    // no need to to this again here.

    if (range) {
      start = PositionConverter.lsp_to_cm(range.start) as IVirtualPosition;
      end = PositionConverter.lsp_to_cm(range.end) as IVirtualPosition;

      start_in_editor = this.virtual_document.transform_virtual_to_editor(
        start
      );
      end_in_editor = this.virtual_document.transform_virtual_to_editor(end);

      cm_editor = this.editor.get_editor_at_root_position(hover_character);
    } else {
      // construct range manually using the token information
      cm_editor = this.virtual_document.root.get_editor_at_source_line(
        hover_character
      );
      let token = this.editor.getTokenAt(hover_character);

      let start_in_root = {
        line: hover_character.line,
        ch: token.start
      } as IRootPosition;
      let end_in_root = {
        line: hover_character.line,
        ch: token.end
      } as IRootPosition;

      start_in_editor = this.editor.root_position_to_editor_position(
        start_in_root
      );
      end_in_editor = this.editor.root_position_to_editor_position(
        end_in_root
      );
    }

    // @ts-ignore
    this.hoverMarker = cm_editor
      .getDoc()
      .markText(start_in_editor, end_in_editor, { className: class_name });
  }

  protected position_from_mouse(ev: MouseEvent): IRootPosition {
    return this.editor.coordsChar(
      {
        left: ev.clientX,
        top: ev.clientY
      },
      'window'
    ) as IRootPosition;
  }

  protected is_token_empty(token: CodeMirror.Token) {
    return token.string.length === 0;
    // TODO  || token.type.length === 0? (sometimes the underline is shown on meaningless tokens)
  }

  // @ts-ignore
  public _handleMouseOver(event: MouseEvent) {
    // currently the events are coming from notebook panel; ideally these would be connected to individual cells,
    // (only cells with code) instead, but this is more complex to implement right. In any case filtering
    // is needed to determine in hovered character belongs to this virtual document

    let root_position = this.position_from_mouse(event);

    // happens because mousemove is attached to panel, not individual code cells,
    // and because some regions of the editor (between lines) have no characters
    if (typeof root_position === 'undefined') {
      this.remove_range_highlight();
      this.hover_character = null;
      return;
    }

    let token = this.editor.getTokenAt(root_position);

    let document = this.editor.document_as_root_position(root_position);
    let virtual_position = this.editor.root_position_to_virtual_position(root_position);

    if (
      this.is_token_empty(token) ||
      document !== this.virtual_document ||
      // @ts-ignore
      !this._isEventInsideVisible(event)
    ) {
      this.remove_range_highlight();
      this.hover_character = null;
      return;
    }

    if (!is_equal(root_position, this.hover_character)) {
      this.hover_character = root_position;
      // @ts-ignore
      this.debouncedGetHover(virtual_position);
    }
  }

  public handleMouseOver(event: MouseEvent) {
    // proceed when no hover modifier or hover modifier pressed
    this.show_next_tooltip =
      !hover_modifier || getModifierState(event, hover_modifier);

    try {
      return this._handleMouseOver(event);
    } catch (e) {
      if (
        !(
          e.message === 'Cell not found in cell_line_map' ||
          e.message === "Cannot read property 'string' of undefined"
        )
      ) {
        throw e;
      }
    }
  }

  protected collapse_overlapping_diagnostics(
    diagnostics: lsProtocol.Diagnostic[]
  ): Map<lsProtocol.Range, lsProtocol.Diagnostic[]> {
    // because Range is not a primitive types, the equality of the objects having
    // the same parameters won't be compared (thus considered equal) in Map.

    // instead, a intermediate step of mapping through a stringified representation of Range is needed:
    // an alternative would be using nested [start line][start character][end line][end character] structure,
    // which would increase the code complexity, but reduce memory use and may be slightly faster.
    type RangeID = string;
    const range_id_to_range = new Map<RangeID, lsProtocol.Range>();
    const range_id_to_diagnostics = new Map<RangeID, lsProtocol.Diagnostic[]>();

    function get_range_id(range: lsProtocol.Range): RangeID {
      return (
        range.start.line +
        ',' +
        range.start.character +
        ',' +
        range.end.line +
        ',' +
        range.end.character
      );
    }

    diagnostics.forEach((diagnostic: lsProtocol.Diagnostic) => {
      let range = diagnostic.range;
      let range_id = get_range_id(range);
      range_id_to_range.set(range_id, range);
      if (range_id_to_diagnostics.has(range_id)) {
        let ranges_list = range_id_to_diagnostics.get(range_id);
        ranges_list.push(diagnostic);
      } else {
        range_id_to_diagnostics.set(range_id, [diagnostic]);
      }
    });

    let map = new Map<lsProtocol.Range, lsProtocol.Diagnostic[]>();

    range_id_to_diagnostics.forEach(
      (range_diagnostics: lsProtocol.Diagnostic[], range_id: RangeID) => {
        let range = range_id_to_range.get(range_id);
        map.set(range, range_diagnostics);
      }
    );

    return map;
  }

  public handleDiagnostic(response: lsProtocol.PublishDiagnosticsParams) {
    /* TODO: gutters */

    // Note: no deep equal for Sets or Maps in JS
    const markers_to_retain: Set<string> = new Set<string>();

    // add new markers, keep track of the added ones

    // from virtual to notebook

    // TODO: test for diagnostic messages not being over-writen
    //  test case: from statistics import mean, bisect_left
    //  and do not use either; expected: title has "mean imported but unused; bisect_left imported and unused'
    // TODO: test case for severity class always being set, even if diagnostic has no severity

    let diagnostics_by_range = this.collapse_overlapping_diagnostics(
      response.diagnostics
    );

    diagnostics_by_range.forEach(
      (diagnostics: lsProtocol.Diagnostic[], range: lsProtocol.Range) => {
        const start = PositionConverter.lsp_to_cm(
          range.start
        ) as IVirtualPosition;
        const end = PositionConverter.lsp_to_cm(range.end) as IVirtualPosition;
        if (start.line > this.virtual_document.last_virtual_line) {
          console.log(
            'Malformed diagnostic was skipped (out of lines) ',
            diagnostics
          );
          return;
        }
        // assuming that we got a response for this document
        let start_in_root = this.transform_virtual_position_to_root_position(
          start
        );
        let document = this.editor.document_as_root_position(start_in_root);

        // TODO why do I get signals from the other connection in the first place?
        if (this.virtual_document !== document) {
          console.log(
            `Ignoring inspections from ${response.uri}`,
            ` (this region is covered by a another virtual document: ${document.uri})`,
            ` inspections: `,
            diagnostics
          );
          return;
        }

        if (
          document.virtual_lines
            .get(start.line)
            .skip_inspect.indexOf(document.id_path) !== -1
        ) {
          console.log(
            'Ignoring inspections silenced for this document:',
            diagnostics
          );
          return;
        }

        let highest_severity_code = diagnostics
          .map(diagnostic => diagnostic.severity || default_severity)
          .sort()[0];

        const severity = diagnosticSeverityNames[highest_severity_code];

        let cm_editor = document.get_editor_at_virtual_line(start);

        let start_in_editor = document.transform_virtual_to_editor(start);
        let end_in_editor = document.transform_virtual_to_editor(end);
        // what a pity there is no hash in the standard library...
        // we could use this: https://stackoverflow.com/a/7616484 though it may not be worth it:
        //   the stringified diagnostic objects are only about 100-200 JS characters anyway,
        //   depending on the message length; this could be reduced using some structure-aware
        //   stringifier; such a stringifier could also prevent the possibility of having a false
        //   negative due to a different ordering of keys
        // obviously, the hash would prevent recovery of info from the key.
        let diagnostic_hash = JSON.stringify({
          // diagnostics without ranges
          diagnostics: diagnostics.map(diagnostic => [
            diagnostic.severity,
            diagnostic.message,
            diagnostic.code,
            diagnostic.source,
            diagnostic.relatedInformation
          ]),
          // the apparent marker position will change in the notebook with every line change for each marker
          // after the (inserted/removed) line - but such markers should not be invalidated,
          // i.e. the invalidation should be performed in the cell space, not in the notebook coordinate space,
          // thus we transform the coordinates and keep the cell id in the hash
          range: {
            start: start_in_editor,
            end: end_in_editor
          },
          editor: this.unique_editor_ids.get(cm_editor)
        });
        markers_to_retain.add(diagnostic_hash);

        if (!this.marked_diagnostics.has(diagnostic_hash)) {
          let options: CodeMirror.TextMarkerOptions = {
            title: diagnostics
              .map(d => d.message + (d.source ? ' (' + d.source + ')' : ''))
              .join('\n'),
            className: 'cm-lsp-diagnostic cm-lsp-diagnostic-' + severity
          };
          let marker;
          try {
            marker = cm_editor
              .getDoc()
              .markText(start_in_editor, end_in_editor, options);
          } catch (e) {
            console.warn(
              'Marking inspection (diagnostic text) failed, see following logs (2):'
            );
            console.log(diagnostics);
            console.log(e);
            return;
          }
          this.marked_diagnostics.set(diagnostic_hash, marker);
        }
      }
    );

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

  private transform_virtual_position_to_root_position(
    start: IVirtualPosition
  ): IRootPosition {
    let cm_editor = this.virtual_document.virtual_lines.get(start.line).editor;
    let editor_position = this.virtual_document.transform_virtual_to_editor(
      start
    );
    return this.editor.transform_editor_to_root(cm_editor, editor_position);
  }
}
