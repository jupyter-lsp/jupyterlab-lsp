import CodeMirror from 'codemirror';

import { CodeMirrorEditor } from '@jupyterlab/codemirror';
import { CodeJumper } from '../../jumpers/jumper';
import { IEditorExtension, KeyModifier } from '../editor';
import { CodeMirrorTokensProvider } from './tokens';

const HANDLERS_ON = '_go_to_are_handlers_on';

function getModifierState(event: MouseEvent, modifierKey: string): boolean {
  // Note: Safari does not support getModifierState on MouseEvent, see:
  // https://github.com/krassowski/jupyterlab-go-to-definition/issues/3
  // thus AltGraph and others are not supported on Safari
  // Full list of modifier keys and mappings to physical keys on different OSes:
  // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/getModifierState

  if (event.getModifierState !== undefined) {
    return event.getModifierState(modifierKey);
  }

  switch (modifierKey) {
    case 'Shift':
      return event.shiftKey;
    case 'Alt':
      return event.altKey;
    case 'Control':
      return event.ctrlKey;
    case 'Meta':
      return event.metaKey;
  }
}

export class CodeMirrorExtension extends CodeMirrorTokensProvider
  implements IEditorExtension {
  jumper: CodeJumper;
  static modifierKey: KeyModifier;

  constructor(editor: CodeMirrorEditor, jumper: CodeJumper) {
    super(editor);
    this.jumper = jumper;
  }

  static configure() {
    // this option is used as a flag to determine if an instance of CodeMirror
    // has been assigned with a handler
    CodeMirror.defineOption(HANDLERS_ON, false, () => {});
  }

  connect() {
    let editor = this.editor.editor;

    if (editor.getOption(HANDLERS_ON)) {
      // this editor instance already has the event handler
      return;
    }

    editor.setOption(HANDLERS_ON, true);

    CodeMirror.on(
      editor,
      'mousedown',
      (editor: CodeMirror.Editor, event: MouseEvent) => {
        //codemirror_editor.addKeydownHandler()
        let target = event.target as HTMLElement;
        const { button } = event;
        if (
          button === 0 &&
          getModifierState(event, CodeMirrorExtension.modifierKey as string)
        ) {
          const classes = ['cm-variable', 'cm-property'];

          if (classes.indexOf(target.className) !== -1) {
            let lookupName = target.textContent;

            let token = this.selectToken(lookupName, target);

            this.jumper.jump_to_definition({
              token: token,
              mouseEvent: event,
              origin: target
            });
          }
          event.preventDefault();
          event.stopPropagation();
        }
      }
    );
  }

  selectToken(lookupName: string, target: HTMLElement) {
    // Offset is needed to handle same-cell jumping.
    // To get offset we could either derive it from the DOM
    // or from the tokens. Tokens sound better, but there is
    // no direct link between DOM and tokens.
    // This can be worked around using:
    //    CodeMirror.display.renderView.measure.map
    // (see: https://stackoverflow.com/a/35937312/6646912)
    // or by simply counting the number of tokens before.
    // For completeness - using cursor does not work reliably:
    // const cursor = this.getCursorPosition();
    // const token = this.getTokenForPosition(cursor);

    let cellTokens = this.editor.getTokens();

    let typeFilterOn =
      target.className.includes('cm-variable') ||
      target.className.includes('cm-property');

    let lookupType =
      target.className.indexOf('cm-variable') !== -1 ? 'variable' : 'property';

    let classFilter = 'cm-' + lookupType;

    let usagesBeforeTarget = CodeMirrorExtension._countUsagesBefore(
      lookupName,
      target,
      classFilter,
      typeFilterOn
    );

    // select relevant token
    let token = null;
    let matchedTokensCount = 0;
    for (let j = 0; j < cellTokens.length; j++) {
      let testedToken = cellTokens[j];
      if (
        testedToken.value === lookupName &&
        (!typeFilterOn || lookupType === testedToken.type)
      ) {
        matchedTokensCount += 1;
        if (matchedTokensCount - 1 === usagesBeforeTarget) {
          token = testedToken;
          break;
        }
      }
    }

    // verify token
    if (token.value !== lookupName) {
      console.error(
        `Token ${token.value} does not match element ${lookupName}`
      );
      // fallback
      token = {
        value: lookupName,
        offset: 0, // dummy offset
        type: lookupType
      };
    }

    return token;
  }

  static _countUsagesBefore(
    lookupName: string,
    target: Node,
    classFilter: string,
    classFilterOn: boolean
  ) {
    // count tokens with same value that occur before
    // (not all the tokens - to reduce the hurdle of
    // mapping DOM into tokens)
    let usagesBeforeTarget = -1;
    let sibling = target as Node;

    const root = sibling.getRootNode();

    // usually should not exceed that level, but to prevent huge files from trashing the UI...
    let max_iter = 10000;

    function stop_condition(node: Node) {
      return (
        !node ||
        (node.nodeType == 1 &&
          (node as HTMLElement).className.includes('CodeMirror-lines'))
      );
    }

    while (!stop_condition(sibling) && !sibling.isEqualNode(root) && max_iter) {
      if (
        sibling.textContent === lookupName &&
        (!classFilterOn ||
          (sibling.nodeType === 1 &&
            (sibling as HTMLElement).className.includes(classFilter)))
      ) {
        usagesBeforeTarget += 1;
      }

      let nextSibling = sibling.previousSibling;

      while (nextSibling == null) {
        while (!sibling.previousSibling) {
          sibling = sibling.parentNode;
          if (stop_condition(sibling)) {
            return usagesBeforeTarget;
          }
        }
        sibling = sibling.previousSibling;
        while (sibling.lastChild && sibling.textContent != lookupName) {
          sibling = sibling.lastChild;
        }
        nextSibling = sibling;
      }
      sibling = nextSibling;

      max_iter -= 1;
    }

    return usagesBeforeTarget;
  }
}
