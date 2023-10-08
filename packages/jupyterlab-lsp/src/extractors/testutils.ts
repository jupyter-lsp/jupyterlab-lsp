import { CodeEditor } from '@jupyterlab/codeeditor';
import {
  Document,
  VirtualDocument,
  CodeExtractorsManager
} from '@jupyterlab/lsp';

import { IForeignCodeExtractorsRegistry } from '../extractors/types';

export function mockExtractorsManager(
  foreignCodeExtractors: IForeignCodeExtractorsRegistry
): CodeExtractorsManager {
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
  foreignDocumentMap: Map<CodeEditor.IRange, Document.IVirtualDocumentBlock>
): IDocumentWithRange {
  expect(foreignDocumentMap.size).toBe(1);

  let range = foreignDocumentMap.keys().next().value;
  let { virtualDocument } = foreignDocumentMap.get(range)!;

  return { range, virtualDocument };
}

export function getTheOnlyVirtual(
  foreignDocumentMap: Map<CodeEditor.IRange, Document.IVirtualDocumentBlock>
) {
  let { virtualDocument } = getTheOnlyPair(foreignDocumentMap);
  return virtualDocument;
}

export function wrapInPythonLines(line: string) {
  return 'print("some code before")\n' + line + '\n' + 'print("and after")\n';
}
