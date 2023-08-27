import { IDocumentWidget } from '@jupyterlab/docregistry';
import { VirtualDocument, WidgetLSPAdapter, Document } from '@jupyterlab/lsp';
import { nullTranslator, TranslationBundle } from '@jupyterlab/translation';
import React from 'react';

import { TLanguageServerSpec } from '../tokens';

export function getBreadcrumbs(
  document: VirtualDocument,
  adapter: WidgetLSPAdapter<IDocumentWidget>,
  trans?: TranslationBundle,
  collapse = true
): JSX.Element[] {
  if (!trans) {
    trans = nullTranslator.load('');
  }
  return document.ancestry.map((document: VirtualDocument) => {
    if (!document.parent) {
      let path = document.path;
      if (
        !document.hasLspSupportedFile &&
        document.fileExtension &&
        path.endsWith(document.fileExtension)
      ) {
        path = path.slice(0, -document.fileExtension.length - 1);
      }
      const fullPath = path;
      if (collapse) {
        let parts = path.split('/');
        if (parts.length > 2) {
          path = parts[0] + '/.../' + parts[parts.length - 1];
        }
      }
      return (
        <span key={document.uri} title={fullPath}>
          {path}
        </span>
      );
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const virtualLines = document.virtualLines;

    if (!virtualLines.size) {
      return <span key={document.uri}>Empty document</span>;
    }
    try {
      if (adapter.hasMultipleEditors) {
        let firstLine = virtualLines.get(0)!;
        let lastLine = virtualLines.get(document.lastVirtualLine - 1)!;

        let firstCell = adapter.getEditorIndex(firstLine.editor);
        let lastCell = adapter.getEditorIndex(lastLine.editor);

        let cellLocator =
          firstCell === lastCell
            ? trans!.__('cell %1', firstCell + 1)
            : trans!.__('cells: %1-%2', firstCell + 1, lastCell + 1);

        return (
          <span key={document.uri}>
            {document.language} ({cellLocator})
          </span>
        );
      }
    } catch (e) {
      console.warn('LSP: could not display document cell location', e);
    }
    return <span key={document.uri}>{document.language}</span>;
  });
}

async function focusEditor(accessor: Document.IEditor) {
  if (!accessor) {
    return;
  }
  await accessor.reveal();
  const editor = accessor.getEditor();
  editor!.focus();
}

export function DocumentLocator(props: {
  document: VirtualDocument;
  adapter: WidgetLSPAdapter<any>;
  trans?: TranslationBundle;
}) {
  let { document, adapter } = props;
  let target: Document.IEditor | null = null;
  if (adapter.hasMultipleEditors) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    let firstLine = document.virtualLines.get(0);
    if (firstLine) {
      target = firstLine.editor;
    } else {
      console.warn('Could not get first line of ', document);
    }
  }
  let breadcrumbs = getBreadcrumbs(document, adapter, props.trans);
  return (
    <div
      className={'lsp-document-locator'}
      onClick={() => (target ? focusEditor(target) : null)}
    >
      {breadcrumbs}
    </div>
  );
}

export function ServerLinksList(props: { specification: TLanguageServerSpec }) {
  return (
    <ul className={'lsp-server-links-list'}>
      {Object.entries(props.specification?.urls || {}).map(([name, url]) => (
        <li key={props.specification.serverId + '-url-' + name}>
          {name}:{' '}
          <a href={url} target="_blank" rel="noreferrer">
            {url}
          </a>
        </li>
      ))}
    </ul>
  );
}
