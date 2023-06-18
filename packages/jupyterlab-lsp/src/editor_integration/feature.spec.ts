import { PageConfig } from '@jupyterlab/coreutils';
import * as nbformat from '@jupyterlab/nbformat';
import { NotebookModel } from '@jupyterlab/notebook';
import * as lsProtocol from 'vscode-languageserver-protocol';

import { foreignCodeExtractors } from '../transclusions/ipython/extractors';
import { overrides } from '../transclusions/ipython/overrides';

import { CodeMirrorIntegration } from './codemirror';
import {
  FileEditorFeatureTestEnvironment,
  NotebookFeatureTestEnvironment,
  code_cell,
  getCellsJSON,
  python_notebook_metadata,
  showAllCells
} from './testutils';

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

describe('Feature', () => {
  PageConfig.setOption('rootUri', 'file://');

  describe('apply_edit()', () => {
    class EditApplyingFeatureCM extends CodeMirrorIntegration {
      do_apply_edit(workspaceEdit: lsProtocol.WorkspaceEdit) {
        return this.apply_edit(workspaceEdit);
      }
    }

    describe('editing in FileEditor', () => {
      let feature: EditApplyingFeatureCM;
      let environment: FileEditorFeatureTestEnvironment;

      beforeEach(() => {
        environment = new FileEditorFeatureTestEnvironment();
        feature = environment.init_integration({
          constructor: EditApplyingFeatureCM,
          id: 'EditApplyingFeature'
        });
      });

      afterEach(() => {
        environment.dispose();
      });

      it('applies simple edit in FileEditor', async () => {
        environment.ceEditor.model.sharedModel.setSource('foo bar');
        await environment.adapter.update_documents();

        let outcome = await feature.do_apply_edit({
          changes: {
            ['file:///' + environment.document_options.path]: [
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
        let raw_value = environment.ceEditor.doc.toString();
        expect(raw_value).toBe('changed bar');
        expect(environment.ceEditor.model.sharedModel.source).toBe(
          'changed bar'
        );
        expect(outcome.wasGranular).toBe(false);
        expect(outcome.modifiedCells).toBe(1);
        expect(outcome.appliedChanges).toBe(1);
      });

      it('correctly summarizes empty edit', async () => {
        environment.ceEditor.model.sharedModel.setSource('foo bar');
        await environment.adapter.update_documents();

        let outcome = await feature.do_apply_edit({
          changes: {
            ['file:///' + environment.document_options.path]: []
          }
        });
        let raw_value = environment.ceEditor.doc.toString();
        expect(raw_value).toBe('foo bar');
        expect(environment.ceEditor.model.sharedModel.source).toBe('foo bar');
        expect(outcome.wasGranular).toBe(false);
        expect(outcome.appliedChanges).toBe(0);
        expect(outcome.modifiedCells).toBe(0);
      });

      it('applies partial edits', async () => {
        environment.ceEditor.model.sharedModel.setSource(js_fib_code);
        await environment.adapter.update_documents();

        let result = await feature.do_apply_edit({
          changes: {
            ['file:///' + environment.document_options.path]: js_partial_edits
          }
        });
        let raw_value = environment.ceEditor.doc.toString();
        expect(raw_value).toBe(js_fib2_code);
        expect(environment.ceEditor.model.sharedModel.source).toBe(
          js_fib2_code
        );

        expect(result.appliedChanges).toBe(js_partial_edits.length);
        expect(result.wasGranular).toBe(true);
        expect(result.modifiedCells).toBe(1);
      });
    });

    describe('editing in Notebook', () => {
      let feature: EditApplyingFeatureCM;
      let environment: NotebookFeatureTestEnvironment;

      beforeEach(() => {
        environment = new NotebookFeatureTestEnvironment({
          foreignCodeExtractors: {
            python: {
              cell: overrides.filter(override => override.scope == 'cell'),
              line: overrides.filter(override => override.scope == 'line')
            }
          },
          foreignCodeExtractors: foreignCodeExtractors
        });

        feature = environment.init_integration({
          constructor: EditApplyingFeatureCM,
          id: 'EditApplyingFeature'
        });
      });

      afterEach(() => {
        environment.dispose();
      });

      async function synchronizeContent() {
        await environment.adapter.update_documents();
      }

      it('applies edit across cells', async () => {
        let test_notebook = {
          cells: [
            code_cell(['def a_function():\n', '    pass']),
            code_cell(['x = a_function()'])
          ],
          metadata: python_notebook_metadata
        } as nbformat.INotebookContent;

        let notebook = environment.notebook;

        notebook.model = new NotebookModel();
        notebook.model.fromJSON(test_notebook);
        showAllCells(notebook);

        await synchronizeContent();
        let main_document = environment.virtual_editor.virtualDocument;

        let old_virtual_source =
          'def a_function():\n    pass\n\n\nx = a_function()\n';
        let new_virtual_source =
          'def a_function_2():\n    pass\n\n\nx = a_function_2()\n';
        expect(main_document.value).toBe(old_virtual_source);

        let outcome = await feature.do_apply_edit({
          changes: {
            [main_document.document_info.uri]: [
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

        let value = main_document.value;
        expect(value).toBe(new_virtual_source);

        let code_cells = getCellsJSON(notebook);

        expect(code_cells[0]).toHaveProperty(
          'source',
          'def a_function_2():\n    pass'
        );
        expect(code_cells[1]).toHaveProperty('source', 'x = a_function_2()');

        expect(outcome.appliedChanges).toBe(1);
        expect(outcome.wasGranular).toBe(false);
        expect(outcome.modifiedCells).toBe(2);
      });

      it('handles IPython magics', async () => {
        let test_notebook = {
          cells: [
            code_cell(['x = %ls\n', 'print(x)']),
            code_cell(['%%python\n', 'y = x\n', 'print(x)'])
          ],
          metadata: python_notebook_metadata
        } as nbformat.INotebookContent;

        let notebook = environment.notebook;

        notebook.model = new NotebookModel();
        notebook.model.fromJSON(test_notebook);
        showAllCells(notebook);

        let main_document = environment.virtual_editor.virtualDocument;

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
        expect(main_document.value).toBe(old_virtual_source);

        await feature.do_apply_edit({
          changes: {
            [main_document.document_info.uri]: [
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
        await synchronizeContent();
        expect(main_document.value).toBe(new_virtual_source);

        let code_cells = getCellsJSON(notebook);

        expect(code_cells[0]).toHaveProperty('source', 'z = %ls\nprint(z)');
        expect(code_cells[1]).not.toHaveProperty(
          'source',
          '%%python\ny = x\nprint(x)'
        );
      });
    });
  });
});
