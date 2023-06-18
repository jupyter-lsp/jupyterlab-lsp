import { IDocumentWidget } from '@jupyterlab/docregistry';
import { nullTranslator } from '@jupyterlab/translation';
import { CodeExtractorsManager, WidgetLSPAdapter } from '@jupyterlab/lsp';

import { VirtualDocument } from '../virtual/document';

import { getBreadcrumbs } from './utils';

function create_dummy_document(options: Partial<VirtualDocument.IOptions>) {
  return new VirtualDocument({
    language: 'python',
    overridesRegistry: {},
    foreignCodeExtractors: new CodeExtractorsManager(),
    path: 'Untitled.ipynb.py',
    fileExtension: 'py',
    hasLspSupportedFile: false,
    ...options
  });
}

describe('getBreadcrumbs', () => {
  const trans = nullTranslator.load('jupyterlab_lsp');
  it('should collapse long paths', () => {
    let document = create_dummy_document({
      path: 'dir1/dir2/Test.ipynb'
    });
    let breadcrumbs = getBreadcrumbs(
      document,
      {
        hasMultipleEditors: false
      } as WidgetLSPAdapter<IDocumentWidget>,
      trans
    );
    expect(breadcrumbs[0].props['title']).toBe('dir1/dir2/Test.ipynb');
    expect(breadcrumbs[0].props['children']).toBe('dir1/.../Test.ipynb');
  });

  it('should trim the extra filename suffix for files created out of notebooks', () => {
    let document = create_dummy_document({
      path: 'Test.ipynb.py',
      fileExtension: 'py',
      hasLspSupportedFile: false
    });
    let breadcrumbs = getBreadcrumbs(
      document,
      {
        hasMultipleEditors: false
      } as WidgetLSPAdapter<IDocumentWidget>,
      trans
    );
    expect(breadcrumbs[0].props['children']).toBe('Test.ipynb');
  });

  it('should not trim the filename suffix for standalone files', () => {
    let document = create_dummy_document({
      path: 'test.py',
      fileExtension: 'py',
      hasLspSupportedFile: true
    });
    let breadcrumbs = getBreadcrumbs(
      document,
      {
        hasMultipleEditors: false
      } as WidgetLSPAdapter<IDocumentWidget>,
      trans
    );
    expect(breadcrumbs[0].props['children']).toBe('test.py');
  });
});
