// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { Completer } from '@jupyterlab/completer';
import { IRenderMime } from '@jupyterlab/rendermime';

import { CodeCompletion as LSPCompletionSettings } from '../../_completion';
import { FeatureSettings } from '../../feature';
import { ILSPLogConsole } from '../../tokens';

import { CompletionItem, IExtendedCompletionItem } from './item';

export interface ICompletionData {
  item: CompletionItem;
  element: HTMLLIElement;
}

export class LSPCompletionRenderer
  extends Completer.Renderer
  implements Completer.IRenderer
{
  // observers
  private visibilityObserver: IntersectionObserver;
  // element data maps (with weak references for better GC)
  private elementToItem: WeakMap<HTMLLIElement, CompletionItem>;

  protected ITEM_PLACEHOLDER_CLASS = 'lsp-detail-placeholder';
  protected EXTRA_INFO_CLASS = 'jp-Completer-typeExtended';
  protected LABEL_CLASS = 'jp-Completer-match';

  constructor(protected options: LSPCompletionRenderer.IOptions) {
    super();
    this.elementToItem = new WeakMap();

    this.visibilityObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) {
            return;
          }
          let li = entry.target as HTMLLIElement;
          let item = this.elementToItem.get(li)!;
          item.resolve().catch(console.error);
        });
      },
      {
        threshold: 0.25
      }
    );
  }

  protected getExtraInfo(
    item: CompletionItem | IExtendedCompletionItem
  ): string | undefined {
    const labelExtra = this.options.settings.composite.labelExtra;
    const detail = 'detail' in item ? item?.detail ?? '' : '';
    switch (labelExtra) {
      case 'detail':
        return detail;
      case 'type':
        return item?.type?.toLowerCase?.();
      case 'source':
        return item?.source;
      case 'auto':
        return [detail, item?.type?.toLowerCase?.(), item?.source].filter(
          x => !!x
        )[0];
      default:
        this.options.console.warn(
          'labelExtra does not match any of the expected values',
          labelExtra
        );
        return '';
    }
  }

  public updateExtraInfo(
    item: CompletionItem | IExtendedCompletionItem,
    li: HTMLLIElement
  ) {
    const extraText = this.getExtraInfo(item);
    if (extraText) {
      const extraElement = li.getElementsByClassName(this.EXTRA_INFO_CLASS)[0];
      extraElement.textContent = extraText;
      this._elideMark(item, li);
    }
  }

  createCompletionItemNode(
    item: CompletionItem,
    orderedTypes: string[]
  ): HTMLLIElement {
    const li = super.createCompletionItemNode(item, orderedTypes);

    // make sure that an instance reference, and not an object copy is being used;
    const lspItem = item.self;

    // only monitor nodes that have item.self as others are not our completion items
    if (lspItem) {
      lspItem.element = li;
      this.elementToItem.set(li, lspItem);
      this.visibilityObserver.observe(li);
      // TODO: build custom li from ground up
      this.updateExtraInfo(lspItem, li);
      this._elideMark(lspItem, li);
    } else {
      this.updateExtraInfo(item, li);
      this._elideMark(lspItem, li);
    }

    return li;
  }

  private _elideMark(item: IExtendedCompletionItem, li: HTMLLIElement) {
    if (!item || !item.type) {
      return;
    }
    const type = item.type.toLowerCase();
    if (type !== 'file' && type !== 'path') {
      // do not elide for non-paths.
      return;
    }
    const labelElement = li.getElementsByClassName(this.LABEL_CLASS)[0];
    const originalHTMLLabel = labelElement.childNodes;
    let hasMark = false;
    for (const node of originalHTMLLabel) {
      if (node instanceof HTMLElement) {
        const element = node as HTMLElement;
        const text = element.textContent;
        if (element.tagName === 'MARK' && text && text.length > 3) {
          const elidableElement = document.createElement('bdo');
          elidableElement.setAttribute('dir', 'ltr');
          elidableElement.textContent = text;
          element.title = text;
          element.replaceChildren(elidableElement);
          element.classList.add('lsp-elide');
          hasMark = true;
        }
      }
    }
    if (hasMark) {
      const wrapper = document.createElement('div');
      wrapper.className = 'lsp-elide-wrapper';
      wrapper.replaceChildren(...labelElement.childNodes);
      labelElement.replaceChildren(wrapper);
    }
  }

  createDocumentationNode(item: CompletionItem): HTMLElement {
    // note: not worth trying to `fetchDocumentation()` as this is not
    // invoked if documentation is empty (as of jlab 3.2)
    if (item.isDocumentationMarkdown && this.options.markdownRenderer) {
      let documentation = item.documentation;
      this.options.markdownRenderer
        .renderModel({
          data: {
            'text/markdown': documentation
          },
          trusted: false,
          metadata: {},
          setData(options: IRenderMime.IMimeModel.ISetDataOptions) {
            // empty
          }
        })
        .then(() => {
          if (
            this.options.markdownRenderer &&
            this.options.latexTypesetter &&
            documentation &&
            documentation.includes('$')
          ) {
            this.options.latexTypesetter.typeset(
              this.options.markdownRenderer.node
            );
          }
        })
        .catch(this.options.console.warn);
      return this.options.markdownRenderer.node;
    } else if (item.source != 'LSP') {
      // fallback to default implementation for non-LSP completions
      return super.createDocumentationNode(item);
    } else {
      let node = document.createElement('pre');
      if (item.documentation) {
        node.textContent = item.documentation;
      }
      return node;
    }
  }

  itemWidthHeuristic(item: CompletionItem | IExtendedCompletionItem): number {
    let labelSize = item.label.replace(/<(\/)?mark>/g, '').length;
    const extra = this.getExtraInfo(item);
    const extraTextSize = extra?.length ?? 0;
    const type = item.type?.toLowerCase();
    if (type === 'file' || type === 'path') {
      // account for elision
      const parts = item.label.split(/<\/mark>/g);
      const lastPart = parts[parts.length - 1];
      const proposedElipsed = lastPart.length + 3;
      if (proposedElipsed < labelSize) {
        labelSize = proposedElipsed;
      }
    }
    if (this.options.settings.composite.layout === 'side-by-side') {
      // in 'side-by-side' take the sum
      return labelSize + extraTextSize;
    }
    // 'detail-below' mode take whichever is longer
    return Math.max(labelSize, extraTextSize);
  }
}

export namespace LSPCompletionRenderer {
  export interface IOptions {
    settings: FeatureSettings<LSPCompletionSettings>;
    markdownRenderer: IRenderMime.IRenderer | null;
    latexTypesetter?: IRenderMime.ILatexTypesetter | null;
    console: ILSPLogConsole;
  }
}
