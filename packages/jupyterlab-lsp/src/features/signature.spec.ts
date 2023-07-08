import { python } from '@codemirror/lang-python';
import { Language } from '@codemirror/language';
import * as lsProtocol from 'vscode-languageserver-protocol';

import { BrowserConsole } from '../virtual/console';

import { extractLead, signatureToMarkdown } from './signature';

describe('Signature', () => {
  describe('extractLead', () => {
    it('Extracts standalone one-line paragraph', () => {
      const split = extractLead(
        ['This function does foo', '', 'But there are more details'],
        1
      )!;
      expect(split.lead).toBe('This function does foo');
      expect(split.remainder).toBe('But there are more details');
    });
    it('Does not extracts when it would break markdown', () => {
      let split = extractLead(
        ['This is **not the end', '', 'of this spread sentence**'],
        1
      );
      expect(split).toBe(null);

      split = extractLead(
        ['This is <b>not the end', '', 'of this spread sentence</b>'],
        1
      );
      expect(split).toBe(null);
    });
    it('Extracts standalone two-line paragraph', () => {
      const split = extractLead(
        [
          'This function does foo,',
          'and it does bar',
          '',
          'But there are more details'
        ],
        2
      )!;
      expect(split.lead).toBe('This function does foo,\nand it does bar');
      expect(split.remainder).toBe('But there are more details');
    });
    it('Does not extract too long paragraph', () => {
      const split = extractLead(
        [
          'This function does foo,',
          'and it does bar',
          '',
          'But there are more details'
        ],
        1
      );
      expect(split).toBe(null);
    });
  });

  describe('SignatureToMarkdown', () => {
    const MockHighlighter = (
      code: string,
      fragment: lsProtocol.ParameterInformation,
      _language: Language | undefined
    ) => {
      const label = typeof fragment.label === 'string' ? fragment.label : '';
      return code.replace(label, `<u>${label}</u>`);
    };

    it('renders plaintext signature', async () => {
      let text = signatureToMarkdown(
        {
          label: 'str(text)',
          documentation: 'Create a new *string* object from the given object.',
          parameters: [
            {
              label: 'text',
              documentation: undefined
            }
          ],
          activeParameter: 0
        },
        python().language,
        MockHighlighter,
        new BrowserConsole()
      );
      expect(text).toBe(
        'str(<u>text</u>)\n\nCreate a new \\*string\\* object from the given object.\n'
      );
    });

    it('renders plaintext signature with MarkupContent documentation', async () => {
      let text = signatureToMarkdown(
        {
          label: 'str(text)',
          documentation: {
            value: 'Create a new *string* object from the given object.',
            kind: 'plaintext'
          },
          parameters: [
            {
              label: 'text',
              documentation: undefined
            }
          ],
          activeParameter: 0
        },
        python().language,
        MockHighlighter,
        new BrowserConsole()
      );
      expect(text).toBe(
        'str(<u>text</u>)\n\nCreate a new \\*string\\* object from the given object.\n'
      );
    });

    it('renders Markdown signature', async () => {
      let text = signatureToMarkdown(
        {
          label: 'str(text)',
          documentation: {
            value: 'Create a new *string* object from the given object.',
            kind: 'markdown'
          },
          parameters: [
            {
              label: 'text',
              documentation: undefined
            }
          ],
          activeParameter: 0
        },
        python().language,
        MockHighlighter,
        new BrowserConsole()
      );
      expect(text).toBe(
        'str(<u>text</u>)\n\nCreate a new *string* object from the given object.'
      );
    });

    it('renders plaintext with details and paramaters', async () => {
      let text = signatureToMarkdown(
        {
          label: 'str(text)',
          documentation: {
            value: 'line 1\n\nline 2\nline 3\nline 4\nline 5',
            kind: 'plaintext'
          },
          parameters: [
            {
              label: 'text',
              documentation: undefined
            }
          ],
          activeParameter: 0
        },
        python().language,
        MockHighlighter,
        new BrowserConsole(),
        undefined,
        4
      );
      expect(text).toBe(
        'str(<u>text</u>)\n\nline 1\n<details>\nline 2\nline 3\nline 4\nline 5\n</details>'
      );
    });

    it('renders plaintext with details and no parameters', async () => {
      let text = signatureToMarkdown(
        {
          label: 'str()',
          documentation: {
            value: 'line 1\n\nline 2\nline 3\nline 4\nline 5',
            kind: 'plaintext'
          }
        },
        python().language,
        MockHighlighter,
        new BrowserConsole(),
        undefined,
        4
      );
      expect(text).toBe(
        '```python\nstr()\n```\n\nline 1\n<details>\nline 2\nline 3\nline 4\nline 5\n</details>'
      );
    });
  });
});
