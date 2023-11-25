// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { CompleterModel, CompletionHandler } from '@jupyterlab/completer';
import { StringExt } from '@lumino/algorithm';

import { CompletionItem } from './item';

interface ICompletionMatch<T extends CompletionHandler.ICompletionItem> {
  /**
   * A score which indicates the strength of the match.
   *
   * A lower score is better. Zero is the best possible score.
   */
  score: number;
  item: T;
}

function escapeHTML(text: string) {
  let node = document.createElement('span');
  node.textContent = text;
  return node.innerHTML;
}

/**
 * A lot of this was contributed upstream
 */
export class GenericCompleterModel<
  T extends CompletionHandler.ICompletionItem
> extends CompleterModel {
  public settings: GenericCompleterModel.IOptions;

  constructor(settings: GenericCompleterModel.IOptions = {}) {
    super();
    // TODO: refactor upstream so that it does not block "options"?
    this.settings = { ...GenericCompleterModel.defaultOptions, ...settings };
  }

  completionItems(): T[] {
    let query = this.query;
    // (setting query is bad because it resets the cache; ideally we would
    // modify the sorting and filtering algorithm upstream).

    // TODO processedItemsCache
    this.query = '';

    let unfilteredItems = (
      super.completionItems() as CompletionHandler.ICompletionItem[]
    ).map(this.harmoniseItem);

    this.query = query;

    // always want to sort
    // TODO does this behave strangely with %%<tab> if always sorting?
    return this._sortAndFilter(query, unfilteredItems);
  }

  protected harmoniseItem(item: CompletionHandler.ICompletionItem): T {
    return item as T;
  }

  private _markFragment(value: string): string {
    return `<mark>${value}</mark>`;
  }

  protected getFilterText(item: T) {
    return this.getHighlightableLabelRegion(item);
  }

  protected getHighlightableLabelRegion(item: T) {
    // TODO: ideally label and params would be separated so we don't have to do
    //  things like these which are not language-agnostic
    //  (assume that params follow after first opening parenthesis which may not be the case);
    //  the upcoming LSP 3.17 includes CompletionItemLabelDetails
    //  which separates parameters from the label
    // With ICompletionItems, the label may include parameters, so we exclude them from the matcher.
    // e.g. Given label `foo(b, a, r)` and query `bar`,
    // don't count parameters, `b`, `a`, and `r` as matches.
    const index = item.label.indexOf('(');
    return index > -1 ? item.label.substring(0, index) : item.label;
  }

  createPatch(patch: string) {
    if (this.subsetMatch) {
      // Prevent insertion code path when auto-populating subset on tab, to avoid problems with
      // prefix which is a subset of token incorrectly replacing a string with file system path.
      // - Q: Which code path is being blocked?
      //   A: The code path (b) discussed in https://github.com/jupyterlab/jupyterlab/issues/15130.
      // - Q: Why are we short- circuiting here?
      //   A: we want to prevent `onCompletionSelected()` from proceeding with text insertion,
      //      but direct extension of Completer handler is difficult.
      return undefined;
    }
    return super.createPatch(patch);
  }

  protected resolveQuery(userQuery: string, _item: T) {
    return userQuery;
  }

  private _sortAndFilter(userQuery: string, items: T[]): T[] {
    let results: ICompletionMatch<T>[] = [];

    for (let item of items) {
      // See if label matches query string

      let matched: boolean;

      let filterText: string | null = null;
      let filterMatch: StringExt.IMatchResult | null = null;

      const query = this.resolveQuery(userQuery, item);

      let lowerCaseQuery = query.toLowerCase();

      if (query) {
        filterText = this.getFilterText(item);
        if (this.settings.caseSensitive) {
          filterMatch = StringExt.matchSumOfSquares(filterText, query);
        } else {
          filterMatch = StringExt.matchSumOfSquares(
            filterText.toLowerCase(),
            lowerCaseQuery
          );
        }
        matched = !!filterMatch;
        if (!this.settings.includePerfectMatches) {
          matched = matched && filterText != query;
        }
      } else {
        matched = true;
      }

      // Filter non-matching items. Filtering may happen on a criterion different than label.
      if (matched) {
        // If the matches are substrings of label, highlight them
        // in this part of the label that can be highlighted (must be a prefix),
        // which is intended to avoid highlighting matches in function arguments etc.
        let labelMatch: StringExt.IMatchResult | null = null;
        if (query) {
          let labelPrefix = escapeHTML(this.getHighlightableLabelRegion(item));
          if (labelPrefix == filterText) {
            labelMatch = filterMatch;
          } else {
            labelMatch = StringExt.matchSumOfSquares(labelPrefix, query);
          }
        }

        let label: string;
        let score: number;

        if (labelMatch) {
          // Highlight label text if there's a match
          // there won't be a match if filter text includes additional keywords
          // for easier search that are not a part of the label
          let marked = StringExt.highlight(
            escapeHTML(item.label),
            labelMatch.indices,
            this._markFragment
          );
          label = marked.join('');
          score = labelMatch.score;
        } else {
          label = escapeHTML(item.label);
          score = 0;
        }
        // preserve getters (allow for lazily retrieved documentation)
        const itemClone = Object.create(
          Object.getPrototypeOf(item),
          Object.getOwnPropertyDescriptors(item)
        );
        itemClone.label = label;
        // If no insertText is present, preserve original label value
        // by setting it as the insertText.
        itemClone.insertText = item.insertText ? item.insertText : item.label;

        results.push({
          item: itemClone,
          score: score
        });
      }
    }

    results.sort(this.compareMatches.bind(this));

    return results.map(x => x.item);
  }

  protected compareMatches(
    a: ICompletionMatch<T>,
    b: ICompletionMatch<T>
  ): number {
    const delta = a.score - b.score;
    if (delta !== 0) {
      return delta;
    }
    return a.item.insertText?.localeCompare(b.item.insertText ?? '') ?? 0;
  }
}

export namespace GenericCompleterModel {
  export interface IOptions {
    /**
     * Whether matching should be case-sensitive (default = true)
     */
    caseSensitive?: boolean;
    /**
     * Whether perfect matches should be included (default = true)
     */
    includePerfectMatches?: boolean;
    /**
     * Whether kernel completions should be shown first.
     */
    kernelCompletionsFirst?: boolean;
  }
  export const defaultOptions: IOptions = {
    caseSensitive: true,
    includePerfectMatches: true,
    kernelCompletionsFirst: false
  };
}

type MaybeCompletionItem = Partial<CompletionItem> &
  CompletionHandler.ICompletionItem;

export class LSPCompleterModel extends GenericCompleterModel<MaybeCompletionItem> {
  public settings: LSPCompleterModel.IOptions;

  constructor(settings: LSPCompleterModel.IOptions = {}) {
    super();
    this.settings = { ...LSPCompleterModel.defaultOptions, ...settings };
  }

  protected getFilterText(item: MaybeCompletionItem): string {
    if (item.filterText) {
      return item.filterText;
    }
    return super.getFilterText(item);
  }

  setCompletionItems(newValue: MaybeCompletionItem[]) {
    super.setCompletionItems(newValue);
    this._preFilterQuery = '';

    if (this.current && this.cursor) {
      // set initial query to pre-filter items; in future we should use:
      // https://github.com/jupyterlab/jupyterlab/issues/9763#issuecomment-1001603348

      // note: start/end from cursor are not ideal because these get populated from fetch
      // reply which will vary depending on what providers decide to return; we want the
      // actual position in token, the same as passed in request to fetch. We can get it
      // by searching for longest common prefix as seen below (or by counting characters).
      // Maybe upstream should expose it directly?
      const { start, end } = this.cursor;
      const { text, line, column } = this.original!;

      const queryRange = text.substring(start, end).trim();
      const linePrefix = text.split('\n')[line].substring(0, column).trim();
      let query = '';
      for (let i = queryRange.length; i > 0; i--) {
        if (queryRange.slice(0, i) == linePrefix.slice(-i)) {
          query = linePrefix.slice(-i);
          break;
        }
      }
      if (!query) {
        return;
      }

      let trimmedQuotes = false;
      // special case for "Completes Paths In Strings" test case
      if (query.startsWith('"') || query.startsWith("'")) {
        query = query.substring(1);
        trimmedQuotes = true;
      }
      if (query.endsWith('"') || query.endsWith("'")) {
        query = query.substring(0, -1);
        trimmedQuotes = true;
      }
      if (this.settings.preFilterMatches || trimmedQuotes) {
        this._preFilterQuery = query;
      }
    }
  }

  protected resolveQuery(userQuery: string, item: MaybeCompletionItem) {
    return userQuery
      ? userQuery
      : item.source === 'LSP'
      ? this._preFilterQuery
      : '';
  }

  protected harmoniseItem(item: CompletionHandler.ICompletionItem) {
    if ((item as any).self) {
      const self = (item as any).self;
      // reflect any changes made on copy
      self.insertText = item.insertText;
      return self;
    }
    return super.harmoniseItem(item);
  }

  protected compareMatches(
    a: ICompletionMatch<MaybeCompletionItem>,
    b: ICompletionMatch<MaybeCompletionItem>
  ): number {
    // TODO: take source order from provider ranks, upstream this code
    const sourceOrder = {
      LSP: 1,
      kernel: this.settings.kernelCompletionsFirst ? 0 : 2,
      context: 3
    };
    const aRank = a.item.source
      ? sourceOrder[a.item.source as keyof typeof sourceOrder] ?? 4
      : 4;
    const bRank = b.item.source
      ? sourceOrder[b.item.source as keyof typeof sourceOrder] ?? 4
      : 4;
    return (
      aRank - bRank ||
      (a.item.sortText ?? 'z').localeCompare(b.item.sortText ?? 'z') ||
      a.score - b.score
    );
  }

  private _preFilterQuery: string = '';
}

export namespace LSPCompleterModel {
  export interface IOptions extends GenericCompleterModel.IOptions {
    /**
     * Whether matches should be pre-filtered (default = true)
     */
    preFilterMatches?: boolean;
  }
  export const defaultOptions: IOptions = {
    ...GenericCompleterModel.defaultOptions,
    preFilterMatches: true
  };
}
