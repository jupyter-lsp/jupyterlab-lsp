import { CodeEditor } from '@jupyterlab/codeeditor';
import { Document, VirtualDocument, CodeExtractorsManager } from '@jupyterlab/lsp';

import { IForeignCodeExtractorsRegistry } from '../extractors/types';

export function mockExtractorsManager(foreignCodeExtractors: IForeignCodeExtractorsRegistry): CodeExtractorsManager {
  const extractorManager = new CodeExtractorsManager();
    for (const [language, list] of Object.entries(foreignCodeExtractors)) {
      for (const extractor of list) {
        extractorManager.register(extractor, language);
      }
    }
  return extractorManager;
}

export function extractCode(document: VirtualDocument, code: string) {
  return document.extractForeignCode(
    { value: code, ceEditor: null as any, type: 'code' },
    {
      line: 0,
      column: 0
    }
  );
}

interface IDocumentWithRange {
  range: CodeEditor.IRange;
  virtualDocument: VirtualDocument;
}

export function getTheOnlyPair(
  foreignDocument_map: Map<CodeEditor.IRange, Document.IVirtualDocumentBlock>
): IDocumentWithRange {
  expect(foreignDocument_map.size).toBe(1);

  let range = foreignDocument_map.keys().next().value;
  let { virtualDocument } = foreignDocument_map.get(range)!;

  return { range, virtualDocument };
}

export function getTheOnlyVirtual(
  foreignDocument_map: Map<CodeEditor.IRange, Document.IVirtualDocumentBlock>
) {
  let { virtualDocument } = getTheOnlyPair(foreignDocument_map);
  return virtualDocument;
}

export function wrapInPythonLines(line: string) {
  return 'print("some code before")\n' + line + '\n' + 'print("and after")\n';
}
