import {
  diagnosticCount,
  forceLinting,
  forEachDiagnostic,
  Diagnostic
} from '@codemirror/lint';
import { EditorState } from '@codemirror/state';
import { CodeMirrorEditor } from '@jupyterlab/codemirror';
import { CodeExtractorsManager, isEqual } from '@jupyterlab/lsp';
import { framePromise } from '@jupyterlab/testing';
import { nullTranslator } from '@jupyterlab/translation';
import { Signal } from '@lumino/signaling';
import type * as lsProtocol from 'vscode-languageserver-protocol';

import { CodeDiagnostics as LSPDiagnosticsSettings } from '../../_diagnostics';
import { IFeatureSettings } from '../../feature';
import { DiagnosticSeverity } from '../../lsp';
import {
  FileEditorTestEnvironment,
  MockSettings,
  NotebookTestEnvironment,
  codeCell,
  setNotebookContent,
  showAllCells
} from '../../testutils';
import { foreignCodeExtractors } from '../../transclusions/ipython/extractors';

import { diagnosticsPanel } from './diagnostics';
import { DiagnosticsFeature } from './feature';
import { messageWithoutCode } from './listing';

const SETTING_DEFAULTS: LSPDiagnosticsSettings = {
  ignoreCodes: [],
  ignoreMessagesPatterns: [],
  ignoreSeverities: [],
  defaultSeverity: 'Warning'
};

class ShellMock {
  currentChanged = new Signal(this);
}

class ConfigurableDiagnosticsFeature extends DiagnosticsFeature {
  public settings: IFeatureSettings<LSPDiagnosticsSettings>;
}

function getDiagnostics(state: EditorState): Diagnostic[] {
  const markers: Diagnostic[] = [];
  forEachDiagnostic(state, d => markers.push(d));
  return markers;
}

describe('Diagnostics', () => {
  let feature: ConfigurableDiagnosticsFeature;
  let defaultSettings = new MockSettings<LSPDiagnosticsSettings>({
    ...SETTING_DEFAULTS
  });

  describe('FileEditor integration', () => {
    let env: FileEditorTestEnvironment;

    beforeEach(async () => {
      env = new FileEditorTestEnvironment();
      feature = new ConfigurableDiagnosticsFeature({
        trans: nullTranslator.load(''),
        settings: defaultSettings,
        connectionManager: env.connectionManager,
        shell: new ShellMock() as any,
        editorExtensionRegistry: env.editorExtensionRegistry,
        themeManager: null
      });
      await env.init();
    });
    afterEach(() => {
      env.dispose();
    });

    const diagnostics: lsProtocol.Diagnostic[] = [
      {
        range: {
          start: { line: 0, character: 7 },
          end: { line: 0, character: 9 }
        },
        message: 'Undefined symbol "aa"',
        code: 'E001',
        severity: DiagnosticSeverity['Error']
      },
      {
        range: {
          start: { line: 1, character: 3 },
          end: { line: 1, character: 4 }
        },
        message: 'Trimming whitespace',
        code: 'W001',
        severity: DiagnosticSeverity['Warning']
      }
    ];

    const text = 'res = aa + 1\nres ';

    it('renders inspections', async () => {
      env.activeEditor.model.sharedModel.setSource(text);
      await env.adapter.updateDocuments();

      let markers: number;

      markers = diagnosticCount(env.activeEditor.editor.state);
      expect(markers).toBe(0);

      forceLinting(env.activeEditor.editor);
      await feature.handleDiagnostic(
        {
          uri: env.documentOptions.path,
          diagnostics: diagnostics
        },
        env.adapter.virtualDocument!,
        env.adapter
      );
      await framePromise();

      markers = diagnosticCount(env.activeEditor.editor.state);
      expect(markers).toBe(2);
    });

    it('filters out inspections by code', async () => {
      feature.settings = new MockSettings({
        ...SETTING_DEFAULTS,
        ignoreCodes: ['W001']
      });

      env.activeEditor.model.sharedModel.setSource(text);
      await env.adapter.updateDocuments();

      forceLinting(env.activeEditor.editor);
      await feature.handleDiagnostic(
        {
          uri: env.documentOptions.path,
          diagnostics: diagnostics
        },
        env.adapter.virtualDocument!,
        env.adapter
      );
      await framePromise();

      const markers = getDiagnostics(env.activeEditor.editor.state);
      expect(markers.length).toBe(1);
      expect(markers[0].message).toBe('Undefined symbol "aa"');
    });

    it('filters out inspections by severity', async () => {
      feature.settings = new MockSettings({
        ...SETTING_DEFAULTS,
        ignoreSeverities: ['Warning']
      });

      env.activeEditor.model.sharedModel.setSource(text);
      await env.adapter.updateDocuments();

      forceLinting(env.activeEditor.editor);
      await feature.handleDiagnostic(
        {
          uri: env.documentOptions.path,
          diagnostics: diagnostics
        },
        env.adapter.virtualDocument!,
        env.adapter
      );
      await framePromise();

      const markers = getDiagnostics(env.activeEditor.editor.state);
      expect(markers.length).toBe(1);
      expect(markers[0].message).toBe('Undefined symbol "aa"');
    });

    it('filters out inspections by message text', async () => {
      feature.settings = new MockSettings({
        ...SETTING_DEFAULTS,
        ignoreMessagesPatterns: ['Undefined symbol "\\w+"']
      });

      env.activeEditor.model.sharedModel.setSource(text);
      await env.adapter.updateDocuments();

      forceLinting(env.activeEditor.editor);
      await feature.handleDiagnostic(
        {
          uri: env.documentOptions.path,
          diagnostics: diagnostics
        },
        env.adapter.virtualDocument!,
        env.adapter
      );
      await framePromise();

      const markers = getDiagnostics(env.activeEditor.editor.state);
      expect(markers.length).toBe(1);
      expect(markers[0].message).toBe('Trimming whitespace');
    });
  });

  describe('Notebook integration', () => {
    let env: NotebookTestEnvironment;

    beforeEach(async () => {
      const manager = new CodeExtractorsManager();
      for (let language of Object.keys(foreignCodeExtractors)) {
        for (let extractor of foreignCodeExtractors[language]) {
          manager.register(extractor, language);
        }
      }
      env = new NotebookTestEnvironment({
        document: {
          foreignCodeExtractors: manager
        }
      });
      feature = new ConfigurableDiagnosticsFeature({
        trans: nullTranslator.load(''),
        settings: defaultSettings,
        connectionManager: env.connectionManager,
        shell: new ShellMock() as any,
        editorExtensionRegistry: env.editorExtensionRegistry,
        themeManager: null
      });
      await env.init();
    });
    afterEach(() => {
      env.dispose();
    });

    it('renders inspections across cells', async () => {
      setNotebookContent(env.notebook, [
        codeCell(['x =1', 'test']),
        codeCell(['    '])
      ]);
      showAllCells(env.notebook);
      await env.adapter.updateDocuments();

      let document = env.adapter.virtualDocument!;
      let uri = document.uri;

      env.adapter.editors.map(editor =>
        forceLinting((editor.ceEditor.getEditor()! as CodeMirrorEditor).editor)
      );
      await framePromise();
      await feature.handleDiagnostic(
        {
          uri: uri,
          diagnostics: [
            {
              source: 'pyflakes',
              range: {
                start: { line: 1, character: 0 },
                end: { line: 1, character: 5 }
              },
              message: "undefined name 'test'",
              severity: 1
            },
            {
              source: 'pycodestyle',
              range: {
                start: { line: 0, character: 3 },
                end: { line: 0, character: 5 }
              },
              message: 'E225 missing whitespace around operator',
              code: 'E225',
              severity: 2
            },
            {
              source: 'pycodestyle',
              range: {
                start: { line: 4, character: 0 },
                end: { line: 4, character: 5 }
              },
              message: 'W391 blank line at end of file',
              code: 'W391',
              severity: 2
            },
            {
              source: 'pycodestyle',
              range: {
                start: { line: 4, character: 0 },
                end: { line: 4, character: 5 }
              },
              message: 'W293 blank line contains whitespace',
              code: 'W293',
              severity: 2
            },
            {
              source: 'mypy',
              range: {
                start: { line: 1, character: 0 },
                end: { line: 1, character: 4 }
              },
              message: "Name 'test' is not defined",
              severity: 1
            }
          ]
        },
        env.adapter.virtualDocument!,
        env.adapter
      );
      await framePromise();

      let cm_editors = env.adapter.editors.map(
        editor => (editor.ceEditor.getEditor()! as CodeMirrorEditor).editor
      );
      const marks_cell_1 = getDiagnostics(cm_editors[0].state);
      // test from mypy, test from pyflakes, whitespace around operator from pycodestyle
      expect(marks_cell_1.length).toBe(3);

      const marks_cell_2 = getDiagnostics(cm_editors[1].state);
      expect(marks_cell_2.length).toBe(2);

      expect(marks_cell_2[1].message).toContain('W391');
      expect(marks_cell_2[0].message).toContain('W293');

      expect(feature.getDiagnosticsDB(env.adapter).size).toBe(1);
      expect(feature.getDiagnosticsDB(env.adapter).get(document)!.length).toBe(
        5
      );

      feature.switchDiagnosticsPanelSource(env.adapter);
      diagnosticsPanel.widget.content.update();
      // the panel should contain all 5 diagnostics
      let db = diagnosticsPanel.content.model.diagnostics!;
      expect(db.size).toBe(1);
      expect(db.get(document)!.length).toBe(5);
    });

    it.skip('Works in foreign documents', async () => {
      setNotebookContent(env.notebook, [
        codeCell(['valid = 0', 'code = 1', '# here']),
        codeCell(['%%python', 'y = 1', 'x'])
      ]);
      showAllCells(env.notebook);
      await env.adapter.updateDocuments();

      let document = env.adapter.virtualDocument!;
      console.log(document.foreignDocuments);
      expect(document.foreignDocuments.size).toBe(1);
      let foreignDocument = document.foreignDocuments.values().next().value;

      let response = {
        uri: foreignDocument.uri,
        diagnostics: [
          {
            source: 'pyflakes',
            range: {
              start: { line: 1, character: 0 },
              end: { line: 1, character: 2 }
            },
            message: "undefined name 'x'",
            severity: 1
          }
        ]
      } as lsProtocol.PublishDiagnosticsParams;

      // test guards against wrongly propagated responses:
      await feature.handleDiagnostic(response, foreignDocument, env.adapter);

      let cm_editors = env.adapter.editors.map(
        editor => editor.ceEditor.getEditor()! as CodeMirrorEditor
      );

      let marks_cell_1 = getDiagnostics(cm_editors[0].state);
      let marks_cell_2 = getDiagnostics(cm_editors[1].state);

      expect(marks_cell_1.length).toBe(0);
      expect(marks_cell_2.length).toBe(0);

      // correct propagation
      await feature.handleDiagnostic(
        response,
        env.adapter.virtualDocument!,
        env.adapter
      );

      marks_cell_1 = getDiagnostics(cm_editors[0].state);
      marks_cell_2 = getDiagnostics(cm_editors[1].state);

      expect(marks_cell_1.length).toBe(0);
      expect(marks_cell_2.length).toBe(1);

      let mark = marks_cell_2[0];

      const from = cm_editors[1].getPositionAt(mark.from);
      const to = cm_editors[1].getPositionAt(mark.to);

      // second line (0th and 1st virtual lines) + 1 line for '%%python\n' => line: 2
      expect(
        isEqual({ line: from.line, ch: from.column }, { line: 2, ch: 0 })
      ).toBe(true);
      expect(
        isEqual({ line: to.line, ch: to.column }, { line: 2, ch: 1 })
      ).toBe(true);

      // the silenced diagnostic for the %%python magic should be ignored
      await feature.handleDiagnostic(
        {
          uri: document.uri,
          diagnostics: [
            {
              source: 'pyflakes',
              range: {
                start: { line: 5, character: 0 },
                end: { line: 5, character: 52 }
              },
              message: "undefined name 'get_ipython'",
              severity: 1
            }
          ]
        },
        document!,
        env.adapter
      );

      expect(marks_cell_1.length).toBe(0);
    });
  });
});

describe('message_without_code', () => {
  it('Removes redundant code', () => {
    let message = messageWithoutCode({
      source: 'pycodestyle',
      range: {
        start: { line: 4, character: 0 },
        end: { line: 4, character: 5 }
      },
      message: 'W293 blank line contains whitespace',
      code: 'W293',
      severity: 2
    });
    expect(message).toBe('blank line contains whitespace');
  });

  it('Keeps messages without code intact', () => {
    let message = messageWithoutCode({
      source: 'pyflakes',
      range: {
        start: { line: 1, character: 0 },
        end: { line: 1, character: 2 }
      },
      // a message starting from "undefined" is particularly tricky as
      // a lazy implementation can have a coercion of undefined "code"
      // to a string "undefined" which would wrongly chop off "undefined" from message
      message: "undefined name 'x'",
      severity: 1
    });
    expect(message).toBe("undefined name 'x'");
  });
});
