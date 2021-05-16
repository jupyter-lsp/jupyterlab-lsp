// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  GenericCompleterModel,
  ICompletionMatch
} from '@krassowski/completion-manager';

import { LazyCompletionItem } from './item';

export class LSPCompleterModel extends GenericCompleterModel<
  LazyCompletionItem
> {
  protected getFilterText(item: LazyCompletionItem): string {
    if (item.filterText) {
      return item.filterText;
    }
    return super.getFilterText(item);
  }

  protected compareMatches(
    a: ICompletionMatch<LazyCompletionItem>,
    b: ICompletionMatch<LazyCompletionItem>
  ): number {
    const delta = a.score - b.score;
    if (delta !== 0) {
      return delta;
    }
    // solve ties using sortText

    // note: locale compare is case-insensitive
    return a.item.sortText.localeCompare(b.item.sortText);
  }
}
