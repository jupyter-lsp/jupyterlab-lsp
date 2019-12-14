from pathlib import Path
from shutil import rmtree

from .manager import lsp_message_listener
from .paths import file_uri_to_path


def extract_or_none(obj, path):
    for crumb in path:
        try:
            obj = obj[crumb]
        except (KeyError, TypeError):
            return None
    return obj


class EditableFile:

    def __init__(self, path):
        self.path = path
        self.lines = self.read_lines()

    def read_lines(self):
        lines = ['']
        try:
            with open(self.path) as f:
                lines = f.readlines()
        except FileNotFoundError:
            pass
        return lines

    def apply_change(self, text: str, start, end):

        # first remove start-end
        before = self.lines[:start['line']]
        if before:
            before[0] = before[0][:start['character']]

        after = self.lines[end['line']:]
        if after:
            after[-1] = after[-1][end['character']:]

        self.lines = before + text.split('\n') + after

    def write(self):

        Path(self.path).parent.mkdir(parents=True, exist_ok=True)

        with open(self.path, 'w') as f:
            f.write('\n'.join(self.lines))

    @property
    def full_range(self):
        start = {'line': 0, 'character': 0}
        end = {'line': len(self.lines), 'character': len(self.lines[-1])}
        return {'start': start, 'end': end}


def setup_shadow_filesystem(virtual_documents_uri):

    assert virtual_documents_uri.startswith('file:/')

    shadow_filesystem = Path(file_uri_to_path(virtual_documents_uri))
    # create if does no exist (so that removal does not raise)
    shadow_filesystem.mkdir(parents=True, exist_ok=True)
    # remove with contents
    rmtree(str(shadow_filesystem))
    # create again if needed
    shadow_filesystem.mkdir(parents=True, exist_ok=True)

    @lsp_message_listener("client")
    async def shadow_virtual_documents(scope, message, languages, manager):
        """Intercept a message with document contents and a shadow file for it.

        Only create the shadow file if the URI matches the virtual documents URI.
        Returns the path on filesystem where the content was stored.
        """

        write_on = [
            'textDocument/didOpen',
            'textDocument/didChange',
            'textDocument/didSave'
        ]

        if not ('method' in message and message['method'] in write_on):
            return

        document = extract_or_none(message, ['params', 'textDocument'])
        if not document:
            raise ValueError('Could not get textDocument from: {}'.format(message))

        uri = extract_or_none(document, ['uri'])
        if not uri or document is None:
            raise ValueError('Could not get URI from: {}'.format(message))

        if not uri.startswith(virtual_documents_uri):
            return

        path = file_uri_to_path(uri)
        file = EditableFile(path)

        text = extract_or_none(document, ['text'])

        if text is not None:
            changes = [{'text': text}]
        else:
            changes = message['params']['contentChanges']

        if len(changes) > 1:
            print('LSP: up to one change supported at the moment')

        for change in changes:
            change_range = change.get('range', file.full_range)
            file.apply_change(change['text'], **change_range)

        file.write()

        return path

    return shadow_virtual_documents
