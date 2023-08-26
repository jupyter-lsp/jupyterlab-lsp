import { PageConfig } from '@jupyterlab/coreutils';
import { CodeExtractorsManager } from '@jupyterlab/lsp';
import * as nbformat from '@jupyterlab/nbformat';
import { NotebookModel } from '@jupyterlab/notebook';
import * as lsProtocol from 'vscode-languageserver-protocol';

import { EditApplicator } from './edits';
import {
  codeCell,
  getCellsJSON,
  python_notebook_metadata,
  showAllCells,
  FileEditorTestEnvironment,
  NotebookTestEnvironment,
  MockNotebookAdapter
} from './testutils';
import { foreignCodeExtractors } from './transclusions/ipython/extractors';
import { overrides } from './transclusions/ipython/overrides';

const js_fib_code = `function fib(n) {
  return n<2?n:fib(n-1)+fib(n-2);
}

fib(5);

window.location /;`;

const js_fib2_code = `function fib2(n) {
  return n<2?n:fib2(n-1)+fib2(n-2);
}

fib2(5);

window.location /;`;

const js_partial_edits = [
  {
    range: {
      start: {
        line: 0,
        character: 9
      },
      end: {
        line: 0,
        character: 12
      }
    },
    newText: 'fib2'
  },
  {
    range: {
      start: {
        line: 1,
        character: 15
      },
      end: {
        line: 1,
        character: 18
      }
    },
    newText: 'fib2'
  },
  {
    range: {
      start: {
        line: 1,
        character: 24
      },
      end: {
        line: 1,
        character: 27
      }
    },
    newText: 'fib2'
  },
  {
    range: {
      start: {
        line: 4,
        character: 0
      },
      end: {
        line: 4,
        character: 3
      }
    },
    newText: 'fib2'
  }
];

describe('EditApplicator', () => {
  PageConfig.setOption('rootUri', 'file://');

  describe('applyEdit()', () => {
    describe('editing in FileEditor', () => {
      let applicator: EditApplicator;
      let environment: FileEditorTestEnvironment;

      beforeEach(async () => {
        environment = new FileEditorTestEnvironment();
        await environment.init();
        await environment.adapter.ready;
        applicator = new EditApplicator(
          environment.adapter.virtualDocument as any,
          environment.adapter
        );
      });

      afterEach(() => {
        environment.dispose();
      });

      it('applies simple edit in FileEditor', async () => {
        environment.activeEditor.model.sharedModel.setSource('foo bar');
        await environment.adapter.updateDocuments();

        let outcome = await applicator.applyEdit({
          changes: {
            ['file:///' + environment.documentOptions.path]: [
              {
                range: {
                  start: { line: 0, character: 0 },
                  end: { line: 1, character: 0 }
                },
                newText: 'changed bar'
              } as lsProtocol.TextEdit
            ]
          }
        });
        expect(environment.activeEditor.model.sharedModel.source).toBe(
          'changed bar'
        );
        let raw_value = environment.activeEditor.editor.state.doc.toString();
        expect(raw_value).toBe('changed bar');
        expect(outcome.wasGranular).toBe(false);
        expect(outcome.modifiedCells).toBe(1);
        expect(outcome.appliedChanges).toBe(1);
      });

      it('correctly summarizes empty edit', async () => {
        environment.activeEditor.model.sharedModel.setSource('foo bar');
        await environment.adapter.updateDocuments();

        let outcome = await applicator.applyEdit({
          changes: {
            ['file:///' + environment.documentOptions.path]: []
          }
        });
        let raw_value = environment.activeEditor.editor.state.doc.toString();
        expect(raw_value).toBe('foo bar');
        expect(environment.activeEditor.model.sharedModel.source).toBe(
          'foo bar'
        );
        expect(outcome.wasGranular).toBe(false);
        expect(outcome.appliedChanges).toBe(0);
        expect(outcome.modifiedCells).toBe(0);
      });

      it('applies partial edits', async () => {
        environment.activeEditor.model.sharedModel.setSource(js_fib_code);
        await environment.adapter.updateDocuments();

        let result = await applicator.applyEdit({
          changes: {
            ['file:///' + environment.documentOptions.path]: js_partial_edits
          }
        });
        let raw_value = environment.activeEditor.editor.state.doc.toString();
        expect(raw_value).toBe(js_fib2_code);
        expect(environment.activeEditor.model.sharedModel.source).toBe(
          js_fib2_code
        );

        expect(result.appliedChanges).toBe(js_partial_edits.length);
        expect(result.wasGranular).toBe(true);
        expect(result.modifiedCells).toBe(1);
      });
    });

    describe('editing in Notebook', () => {
      let applicator: EditApplicator;
      let environment: NotebookTestEnvironment;

      beforeEach(async () => {
        const manager = new CodeExtractorsManager();
        for (let language of Object.keys(foreignCodeExtractors)) {
          for (let extractor of foreignCodeExtractors[language]) {
            manager.register(extractor, language);
          }
        }
        environment = new NotebookTestEnvironment({
          document: {
            overridesRegistry: {
              python: {
                cell: overrides.filter(override => override.scope == 'cell'),
                line: overrides.filter(override => override.scope == 'line')
              }
            },
            foreignCodeExtractors: manager
          }
        });
        await environment.init();
        applicator = new EditApplicator(
          // TODO usptream, adatper should be parameterizable by virtual documentation class to allow overriding it more easily??
          environment.adapter.virtualDocument as any,
          environment.adapter
        );
      });

      afterEach(() => {
        environment.dispose();
      });

      async function synchronizeContent() {
        await environment.adapter.updateDocuments();
      }

      it('applies edit across cells', async () => {
        let test_notebook = {
          cells: [
            codeCell(['def a_function():', '    pass']),
            codeCell(['x = a_function()'])
          ],
          metadata: python_notebook_metadata
        } as nbformat.INotebookContent;

        let notebook = environment.notebook;

        notebook.model = new NotebookModel();
        notebook.model.fromJSON(test_notebook);
        showAllCells(notebook);

        await synchronizeContent();
        let mainDocument = environment.adapter.virtualDocument!;

        let old_virtual_source =
          'def a_function():\n    pass\n\n\nx = a_function()\n';
        let new_virtual_source =
          'def a_function_2():\n    pass\n\n\nx = a_function_2()\n';
        expect(mainDocument.value).toBe(old_virtual_source);

        let outcome = await applicator.applyEdit({
          changes: {
            [mainDocument.documentInfo.uri]: [
              {
                range: {
                  start: { line: 0, character: 0 },
                  end: { line: 5, character: 0 }
                },
                newText: new_virtual_source
              } as lsProtocol.TextEdit
            ]
          }
        });

        await synchronizeContent();

        let value = mainDocument.value;
        expect(value).toBe(new_virtual_source);

        let codeCells = getCellsJSON(notebook);

        expect(codeCells[0]).toHaveProperty(
          'source',
          'def a_function_2():\n    pass'
        );
        expect(codeCells[1]).toHaveProperty('source', 'x = a_function_2()');

        expect(outcome.appliedChanges).toBe(1);
        expect(outcome.wasGranular).toBe(false);
        expect(outcome.modifiedCells).toBe(2);
      });

      it('handles IPython magics', async () => {
        let test_notebook = {
          cells: [
            codeCell(['x = %ls', 'print(x)']),
            codeCell(['%%python', 'y = x', 'print(x)'])
          ],
          metadata: python_notebook_metadata
        } as nbformat.INotebookContent;

        let notebook = environment.notebook;

        notebook.model = new NotebookModel();
        notebook.model.fromJSON(test_notebook);
        showAllCells(notebook);

        await (environment.adapter as MockNotebookAdapter).foreingDocumentOpened
          .promise;

        let mainDocument = environment.adapter.virtualDocument!;

        let old_virtual_source = `x = get_ipython().run_line_magic("ls", "")
print(x)


get_ipython().run_cell_magic("python", "", """y = x
print(x)""")
`;

        let new_virtual_source = `z = get_ipython().run_line_magic("ls", "")
print(z)


get_ipython().run_cell_magic("python", "", """y = x
print(x)""")
`;

        await synchronizeContent();
        expect(mainDocument.value).toBe(old_virtual_source);

        await applicator.applyEdit({
          changes: {
            [mainDocument.documentInfo.uri]: [
              {
                range: {
                  start: { line: 0, character: 0 },
                  end: { line: 6, character: 10 }
                },
                newText: new_virtual_source
              } as lsProtocol.TextEdit
            ]
          }
        });
        await (environment.adapter as MockNotebookAdapter).foreingDocumentOpened
          .promise;

        await synchronizeContent();
        expect(mainDocument.value).toBe(new_virtual_source);

        let codeCells = getCellsJSON(notebook);

        expect(codeCells[0]).toHaveProperty('source', 'z = %ls\nprint(z)');
        //expect(codeCells[1]).not.toHaveProperty(
        //  'source',
        //  '%%python\ny = x\nprint(x)'
        //);
      });
    });
  });
});
