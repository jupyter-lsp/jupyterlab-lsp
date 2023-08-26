import * as lsProtocol from 'vscode-languageserver-types';

import { CompletionItem } from './item';
import { LSPCompleterModel } from './model';

describe('LSPCompleterModel', () => {
  let model: LSPCompleterModel;

  function createDummyItem(
    match: lsProtocol.CompletionItem,
    type: string = 'dummy'
  ) {
    return new CompletionItem({
      type,
      icon: null as any,
      match,
      connection: null as any,
      source: 'lsp'
    });
  }

  const jupyterIconCompletion = createDummyItem({
    label: '<i class="jp-icon-jupyter"></i> Jupyter',
    filterText: 'i font icon jupyter Jupyter',
    documentation: 'A Jupyter icon implemented with <i> tag'
  });
  const testCompletionA = createDummyItem({
    label: 'test',
    sortText: 'a'
  });
  const testCompletionB = createDummyItem({
    label: 'test',
    sortText: 'b'
  });
  const testCompletionC = createDummyItem({
    label: 'test',
    sortText: 'c'
  });
  const testCompletionTest = createDummyItem({
    label: 'test_test',
    sortText: 'test_test'
  });

  beforeEach(() => {
    model = new LSPCompleterModel({
      caseSensitive: true,
      includePerfectMatches: true
    });
  });

  it('returns escaped when no query', () => {
    model.setCompletionItems([jupyterIconCompletion]);
    model.query = '';

    let markedItems = model.completionItems();
    expect(markedItems[0].label).toBe(
      '&lt;i class="jp-icon-jupyter"&gt;&lt;/i&gt; Jupyter'
    );
  });

  it('marks html correctly', () => {
    model.setCompletionItems([jupyterIconCompletion]);
    model.query = 'Jup';

    let markedItems = model.completionItems();
    expect(markedItems[0].label).toBe(
      '&lt;i class="jp-icon-jupyter"&gt;&lt;/i&gt; <mark>Jup</mark>yter'
    );
  });

  it('ties are solved with sortText', () => {
    model.setCompletionItems([
      testCompletionA,
      testCompletionC,
      testCompletionB
    ]);
    model.query = 'test';
    let sortedItems = model.completionItems();
    expect(sortedItems.map(item => item.sortText)).toEqual(['a', 'b', 'c']);
  });

  it('ignores perfect matches when asked', () => {
    model = new LSPCompleterModel({
      includePerfectMatches: false
    });

    model.setCompletionItems([testCompletionA, testCompletionTest]);
    model.query = 'test';
    let items = model.completionItems();
    // should not include the perfect match 'test'
    expect(items.length).toBe(1);
    expect(items.map(item => item.sortText)).toEqual(['test_test']);
  });

  it('case-sensitivity can be changed', () => {
    model = new LSPCompleterModel();
    model.setCompletionItems([testCompletionA]);
    model.query = 'Test';

    model.settings.caseSensitive = true;
    let items = model.completionItems();
    expect(items.length).toBe(0);

    model.settings.caseSensitive = false;
    items = model.completionItems();
    expect(items.length).toBe(1);
  });

  it('filters use filterText', () => {
    model.setCompletionItems([jupyterIconCompletion]);
    // font is in filterText but not in label
    model.query = 'font';

    let filteredItems = model.completionItems();
    expect(filteredItems.length).toBe(1);

    // class is in label but not in filterText
    model.query = 'class';
    filteredItems = model.completionItems();
    expect(filteredItems.length).toBe(0);
  });

  it('marks appropriate part of label when filterText matches', () => {
    model.setCompletionItems([jupyterIconCompletion]);
    // font is in filterText but not in label
    model.query = 'font';

    // nothing should get highlighted
    let markedItems = model.completionItems();
    expect(markedItems[0].label).toBe(
      '&lt;i class="jp-icon-jupyter"&gt;&lt;/i&gt; Jupyter'
    );

    // i is in both label and filterText
    model.query = 'i';
    markedItems = model.completionItems();
    expect(markedItems[0].label).toBe(
      '&lt;<mark>i</mark> class="jp-icon-jupyter"&gt;&lt;/i&gt; Jupyter'
    );
  });
});
