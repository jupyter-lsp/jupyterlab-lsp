import { JupyterFrontEnd } from '@jupyterlab/application';
import { MainAreaWidget, Notification } from '@jupyterlab/apputils';
import { nullTranslator, TranslationBundle } from '@jupyterlab/translation';
import { LabIcon, copyIcon } from '@jupyterlab/ui-components';
import { Menu } from '@lumino/widgets';

import diagnosticsSvg from '../../../style/icons/diagnostics.svg';
import { jumpToIcon } from '../jump_to';

import { DiagnosticsFeature } from './feature';
import {
  DIAGNOSTICS_LISTING_CLASS,
  DiagnosticsDatabase,
  DiagnosticsListing,
  IDiagnosticsRow
} from './listing';

export const diagnosticsIcon = new LabIcon({
  name: 'lsp:diagnostics',
  svgstr: diagnosticsSvg
});

const CMD_COLUMN_VISIBILITY = 'lsp-set-column-visibility';
const CMD_JUMP_TO_DIAGNOSTIC = 'lsp-jump-to-diagnostic';
const CMD_COPY_DIAGNOSTIC = 'lsp-copy-diagnostic';
const CMD_IGNORE_DIAGNOSTIC_CODE = 'lsp-ignore-diagnostic-code';
const CMD_IGNORE_DIAGNOSTIC_MSG = 'lsp-ignore-diagnostic-message';

/**
 * Escape pattern to form a base of a regular expression.
 * The snippet comes from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#Escaping
 * and is in the Public Domain (CC0):
 *  > Any copyright is dedicated to the Public Domain.
 *  > http://creativecommons.org/publicdomain/zero/1.0/
 */
function escapeRegExp(string: string) {
  return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
}

class DiagnosticsPanel {
  private _content: DiagnosticsListing | null = null;
  private _widget: MainAreaWidget<DiagnosticsListing> | null = null;
  feature: DiagnosticsFeature;
  isRegistered = false;
  trans: TranslationBundle;

  constructor(trans: TranslationBundle) {
    this.trans = trans;
  }

  get widget() {
    if (this._widget == null || this._widget.content.model == null) {
      if (this._widget && !this._widget.isDisposed) {
        this._widget.dispose();
      }
      this._widget = this.initWidget();
    }
    return this._widget;
  }

  get content() {
    return this.widget.content;
  }

  protected initWidget() {
    this._content = new DiagnosticsListing(
      new DiagnosticsListing.Model(this.trans)
    );
    this._content.model.diagnostics = new DiagnosticsDatabase();
    this._content.addClass('lsp-diagnostics-panel-content');
    const widget = new MainAreaWidget({ content: this._content });
    widget.id = 'lsp-diagnostics-panel';
    widget.title.label = this.trans.__('Diagnostics Panel');
    widget.title.closable = true;
    widget.title.icon = diagnosticsIcon;
    return widget;
  }

  update() {
    // if not attached, do not bother to update
    if (!this.widget.isAttached) {
      return;
    }
    this.widget.content.update();
  }

  register(app: JupyterFrontEnd) {
    const widget = this.widget;

    let getColumn = (id: string) => {
      // TODO: a hashmap in the panel itself?
      for (let column of widget.content.columns) {
        if (column.id === id) {
          return column;
        }
      }
      return undefined;
    };

    /** Columns Menu **/
    let columnsMenu = new Menu({ commands: app.commands });
    columnsMenu.title.label = this.trans.__('Panel columns');

    app.commands.addCommand(CMD_COLUMN_VISIBILITY, {
      execute: args => {
        let column = getColumn(args['id'] as string)!;
        column.isVisible = !column.isVisible;
        widget.update();
      },
      label: args => this.trans.__(args['id'] as string),
      isToggled: args => {
        let column = getColumn(args['id'] as string);
        return column ? column.isVisible : false;
      }
    });

    for (let column of widget.content.columns) {
      columnsMenu.addItem({
        command: CMD_COLUMN_VISIBILITY,
        args: { id: column.id }
      });
    }
    app.contextMenu.addItem({
      selector: '.' + DIAGNOSTICS_LISTING_CLASS + ' th',
      submenu: columnsMenu,
      type: 'submenu'
    });

    /** Diagnostics Menu **/
    let ignoreDiagnosticsMenu = new Menu({ commands: app.commands });
    ignoreDiagnosticsMenu.title.label = this.trans.__(
      'Ignore diagnostics like this'
    );

    let getRow = (): IDiagnosticsRow | undefined => {
      let tr = app.contextMenuHitTest(
        node => node.tagName.toLowerCase() == 'tr'
      );
      if (!tr) {
        return;
      }
      return this.widget.content.getDiagnostic(tr.dataset.key!);
    };

    ignoreDiagnosticsMenu.addItem({
      command: CMD_IGNORE_DIAGNOSTIC_CODE
    });
    ignoreDiagnosticsMenu.addItem({
      command: CMD_IGNORE_DIAGNOSTIC_MSG
    });
    app.commands.addCommand(CMD_IGNORE_DIAGNOSTIC_CODE, {
      execute: () => {
        const row = getRow();
        if (!row) {
          console.warn(
            'LPS: diagnostics row not found for ignore code execute()'
          );
          return;
        }
        const diagnostic = row.data.diagnostic;
        let current = this.content.model.settings.composite.ignoreCodes;
        this.content.model.settings.set('ignoreCodes', [
          ...current,
          diagnostic.code
        ]);
        this.feature.refreshDiagnostics();
      },
      isVisible: () => {
        const row = getRow();
        if (!row) {
          return false;
        }
        const diagnostic = row.data.diagnostic;
        return !!diagnostic.code;
      },
      label: () => {
        const row = getRow();
        if (!row) {
          return '';
        }
        const diagnostic = row.data.diagnostic;
        return this.trans.__(
          'Ignore diagnostics with "%1" code',
          diagnostic.code
        );
      }
    });
    app.commands.addCommand(CMD_IGNORE_DIAGNOSTIC_MSG, {
      execute: () => {
        const row = getRow();
        if (!row) {
          console.warn(
            'LPS: diagnostics row not found for ignore message execute()'
          );
          return;
        }
        const diagnostic = row.data.diagnostic;
        let current =
          this.content.model.settings.composite.ignoreMessagesPatterns;
        this.content.model.settings.set('ignoreMessagesPatterns', [
          ...current,
          escapeRegExp(diagnostic.message)
        ]);
        this.feature.refreshDiagnostics();
      },
      isVisible: () => {
        const row = getRow();
        if (!row) {
          return false;
        }
        const diagnostic = row.data.diagnostic;
        return !!diagnostic.message;
      },
      label: () => {
        const row = getRow();
        if (!row) {
          return '';
        }
        const diagnostic = row.data.diagnostic;
        return this.trans.__(
          'Ignore diagnostics with "%1" message',
          diagnostic.message
        );
      }
    });

    app.commands.addCommand(CMD_JUMP_TO_DIAGNOSTIC, {
      execute: () => {
        const row = getRow();
        if (!row) {
          console.warn('LPS: diagnostics row not found for jump execute()');
          return;
        }
        this.widget.content.jumpTo(row);
      },
      label: this.trans.__('Jump to location'),
      icon: jumpToIcon
    });

    app.commands.addCommand(CMD_COPY_DIAGNOSTIC, {
      execute: () => {
        const row = getRow();
        if (!row) {
          console.warn('LPS: diagnostics row not found for copy execute()');
          return;
        }
        const message = row.data.diagnostic.message;
        navigator.clipboard
          .writeText(message)
          .then(() => {
            Notification.info(
              this.trans.__('Successfully copied "%1" to clipboard', message)
            );
          })
          .catch(() => {
            console.warn(
              'Could not copy with clipboard.writeText interface, falling back'
            );
            window.prompt(
              this.trans.__(
                'Your browser protects clipboard from write operations; please copy the message manually'
              ),
              message
            );
          });
      },
      label: this.trans.__("Copy diagnostics' message"),
      icon: copyIcon
    });

    app.contextMenu.addItem({
      selector: '.' + DIAGNOSTICS_LISTING_CLASS + ' tbody tr',
      command: CMD_COPY_DIAGNOSTIC
    });
    app.contextMenu.addItem({
      selector: '.' + DIAGNOSTICS_LISTING_CLASS + ' tbody tr',
      command: CMD_JUMP_TO_DIAGNOSTIC
    });
    app.contextMenu.addItem({
      selector: '.' + DIAGNOSTICS_LISTING_CLASS + ' tbody tr',
      submenu: ignoreDiagnosticsMenu,
      type: 'submenu'
    });

    this.isRegistered = true;
  }
}

export const diagnosticsPanel = new DiagnosticsPanel(
  nullTranslator.load('jupyterlab_lsp')
);
