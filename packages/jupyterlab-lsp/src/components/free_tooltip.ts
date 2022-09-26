// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
// (Parts of the FreeTooltip code are copy-paste from Tooltip, ideally this would be PRed be merged)
import { HoverBox } from '@jupyterlab/apputils';
import { CodeEditor } from '@jupyterlab/codeeditor';
import { IDocumentWidget } from '@jupyterlab/docregistry';
import {
  IRenderMime,
  MimeModel,
  IRenderMimeRegistry
} from '@jupyterlab/rendermime';
import { Tooltip } from '@jupyterlab/tooltip';
import { Widget } from '@lumino/widgets';
import * as lsProtocol from 'vscode-languageserver-protocol';

import { WidgetAdapter } from '../adapters/adapter';
import { PositionConverter } from '../converter';
import { IEditorPosition, is_equal } from '../positioning';

const MIN_HEIGHT = 20;
const MAX_HEIGHT = 250;

const CLASS_NAME = 'lsp-tooltip';

interface IFreeTooltipOptions extends Tooltip.IOptions {
  /**
   * Position at which the tooltip should be placed, or null (default) to use the current cursor position.
   */
  position: CodeEditor.IPosition | undefined;
  /**
   * HoverBox privilege.
   */
  privilege?: 'above' | 'below' | 'forceAbove' | 'forceBelow';
  /**
   * Alignment with respect to the current token.
   */
  alignment?: 'start' | 'end' | undefined;
  /**
   * default: true; ESC will always hide
   */
  hideOnKeyPress?: boolean;
}

type Bundle = { 'text/plain': string } | { 'text/markdown': string };

/**
 * Tooltip which can be placed  at any character, not only at the current position (derived from getCursorPosition)
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export class FreeTooltip extends Tooltip {
  constructor(protected options: IFreeTooltipOptions) {
    super(options);
    this._setGeometry();
  }

  setBundle(bundle: Bundle) {
    const model = new MimeModel({ data: bundle });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const content: IRenderMime.IRenderer = this._content;
    content
      .renderModel(model)
      .then(() => this._setGeometry())
      .catch(console.warn);
  }

  handleEvent(event: Event): void {
    if (this.isHidden || this.isDisposed) {
      return;
    }

    const { node } = this;
    const target = event.target as HTMLElement;

    switch (event.type) {
      case 'keydown': {
        const keyCode = (event as KeyboardEvent).keyCode;
        // ESC or Backspace cancel anyways
        if (
          node.contains(target) ||
          (!this.options.hideOnKeyPress && keyCode != 27 && keyCode != 8)
        ) {
          return;
        }
        this.dispose();
        break;
      }
      default:
        super.handleEvent(event);
        break;
    }
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  private _setGeometry(): void {
    // Find the start of the current token for hover box placement.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const editor = this._editor as CodeEditor.IEditor;
    const cursor: CodeEditor.IPosition =
      this.options.position == null
        ? editor.getCursorPosition()
        : this.options.position;
    let position: CodeEditor.IPosition | undefined;

    if (this.options.alignment) {
      const end = editor.getOffsetAt(cursor);
      const line = editor.getLine(cursor.line);

      if (!line) {
        return;
      }

      switch (this.options.alignment) {
        case 'start': {
          const tokens = line.substring(0, end).split(/\W+/);
          const last = tokens[tokens.length - 1];
          const start = last ? end - last.length : end;
          position = editor.getPositionAt(start);
          break;
        }
        case 'end': {
          const tokens = line.substring(0, end).split(/\W+/);
          const last = tokens[tokens.length - 1];
          const start = last ? end - last.length : end;
          position = editor.getPositionAt(start);
          break;
        }
      }
    } else {
      position = cursor;
    }

    if (!position) {
      return;
    }

    const anchor = editor.getCoordinateForPosition(position) as ClientRect;
    const style = window.getComputedStyle(this.node);
    const paddingLeft = parseInt(style.paddingLeft!, 10) || 0;

    // When the editor is attached to the main area, contain the hover box
    // to the full area available (rather than to the editor itself); the available
    // area excludes the toolbar, hence the first Widget child between MainAreaWidget
    // and editor is preferred.
    const host =
      (editor.host.closest('.jp-MainAreaWidget > .lm-Widget') as HTMLElement) ||
      editor.host;

    // Calculate the geometry of the tooltip.
    HoverBox.setGeometry({
      anchor,
      host: host,
      maxHeight: MAX_HEIGHT,
      minHeight: MIN_HEIGHT,
      node: this.node,
      offset: { horizontal: -1 * paddingLeft },
      privilege: this.options.privilege || 'below',
      style: style,
      // TODO: remove `ts-ignore` once minimum version is >=3.5
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      outOfViewDisplay: {
        left: 'stick-inside',
        right: 'stick-outside',
        top: 'stick-outside',
        bottom: 'stick-inside'
      }
    });
  }

  setPosition(position: CodeEditor.IPosition) {
    this.options.position = position;
    this._setGeometry();
  }
}

export namespace EditorTooltip {
  export interface IOptions {
    id?: string;
    markup: lsProtocol.MarkupContent;
    ce_editor: CodeEditor.IEditor;
    position: IEditorPosition;
    adapter: WidgetAdapter<IDocumentWidget>;
    className?: string;
    tooltip?: Partial<IFreeTooltipOptions>;
  }
}

function markupToBundle(markup: lsProtocol.MarkupContent): Bundle {
  return markup.kind === 'plaintext'
    ? { 'text/plain': markup.value }
    : { 'text/markdown': markup.value };
}

export class EditorTooltipManager {
  private currentTooltip: FreeTooltip | null = null;
  private currentOptions: EditorTooltip.IOptions | null;

  constructor(private rendermime_registry: IRenderMimeRegistry) {}

  create(options: EditorTooltip.IOptions): FreeTooltip {
    this.remove();
    this.currentOptions = options;
    let { markup, position, adapter } = options;
    let widget = adapter.widget;
    const bundle = markupToBundle(markup);
    const tooltip = new FreeTooltip({
      ...(options.tooltip || {}),
      anchor: widget.content,
      bundle: bundle,
      editor: options.ce_editor,
      rendermime: this.rendermime_registry,
      position: PositionConverter.cm_to_ce(position)
    });
    tooltip.addClass(CLASS_NAME);
    if (options.className) {
      tooltip.addClass(options.className);
    }
    Widget.attach(tooltip, document.body);
    this.currentTooltip = tooltip;
    return tooltip;
  }

  showOrCreate(options: EditorTooltip.IOptions): FreeTooltip {
    const samePosition =
      this.currentOptions &&
      is_equal(this.currentOptions.position, options.position);
    const sameMarkup =
      this.currentOptions &&
      this.currentOptions.markup.value === options.markup.value &&
      this.currentOptions.markup.kind === options.markup.kind;
    if (
      this.currentTooltip !== null &&
      !this.currentTooltip.isDisposed &&
      this.currentOptions &&
      this.currentOptions.adapter === options.adapter &&
      (samePosition || sameMarkup) &&
      this.currentOptions.ce_editor === options.ce_editor &&
      this.currentOptions.id === options.id
    ) {
      // we only allow either position or markup change, because if both changed,
      // then we may get into problematic race condition in sizing after bundle update.
      if (!sameMarkup) {
        this.currentOptions.markup = options.markup;
        this.currentTooltip.setBundle(markupToBundle(options.markup));
      }
      if (!samePosition) {
        // setting geometry only works when visible
        this.currentTooltip.setPosition(
          PositionConverter.cm_to_ce(options.position)
        );
      }
      this.show();
      return this.currentTooltip;
    } else {
      this.remove();
      return this.create(options);
    }
  }

  get position(): IEditorPosition {
    return this.currentOptions!.position;
  }

  isShown(id?: string): boolean {
    if (id && this.currentOptions && this.currentOptions?.id !== id) {
      return false;
    }
    return (
      this.currentTooltip !== null &&
      !this.currentTooltip.isDisposed &&
      this.currentTooltip.isVisible
    );
  }

  hide() {
    if (this.currentTooltip !== null) {
      this.currentTooltip.hide();
    }
  }

  show() {
    if (this.currentTooltip !== null) {
      this.currentTooltip.show();
    }
  }

  remove() {
    if (this.currentTooltip !== null) {
      this.currentTooltip.dispose();
      this.currentTooltip = null as any;
    }
  }
}
