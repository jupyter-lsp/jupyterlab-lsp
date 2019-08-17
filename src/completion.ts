import {DataConnector} from "@jupyterlab/coreutils";
import {CompletionHandler, ContextConnector} from "@jupyterlab/completer";
import {CodeEditor} from "@jupyterlab/codeeditor";
import {IPosition, LspWsConnection} from "lsp-editor-adapter";
import {ReadonlyJSONObject} from "@phosphor/coreutils";

/**
 * A LSP connector for completion handlers.
 */
export class LSPConnector extends DataConnector<CompletionHandler.IReply,
  void,
  CompletionHandler.IRequest> {
  /**
   * Create a new LSP connector for completion requests.
   *
   * @param options - The instantiation options for the LSP connector.
   */
  constructor(options: LSPConnector.IOptions) {
    super();
    this._editor = options.editor;
    this._connection = options.connection;
    this._completion_characters = this._connection.getLanguageCompletionCharacters();
    this._context_connector = new ContextConnector({editor: options.editor})
  }

  /**
   * Fetch completion requests.
   *
   * @param request - The completion request text and details.
   */
  fetch(
    request: CompletionHandler.IRequest
  ): Promise<CompletionHandler.IReply> {

    try {
      if (this._completion_characters === undefined)
        this._completion_characters = this._connection.getLanguageCompletionCharacters();

      return Private.hint(this._editor, this._connection, this._completion_characters).catch((e) => {
          console.log(e);
          return this._context_connector.fetch(request)
        }
      )
    } catch (e) {
      return this._context_connector.fetch(request)
    }
  }

  private readonly _editor: CodeEditor.IEditor;
  private readonly _connection: LspWsConnection;
  private _completion_characters: Array<string>;
  private _context_connector: ContextConnector;
}

/**
 * A namespace for LSP connector statics.
 */
export namespace LSPConnector {
  /**
   * The instantiation options for cell completion handlers.
   */
  export interface IOptions {
    /**
     * The session used by the LSP connector.
     */
    editor: CodeEditor.IEditor;
    connection: LspWsConnection;
  }
}

function convert_position(position: CodeEditor.IPosition): IPosition {
  return {
    line: position.line,
    ch: position.column
  }
}

async function sleep(timeout: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, timeout);
  })
}

function once_set(x: any, max_retrials: number = 35) {
  return new Promise(async (resolve, reject) => {
    let i = 0;
    while (x.set !== true) {
      i += 1;
      if (i > max_retrials) {
        reject('Too many retrials');
        break
      }
      console.log('waiting');
      await sleep(50)
    }
    resolve(x.value);
  });
}

interface IItemType extends ReadonlyJSONObject {
  // the item value
  text: string
  // the item type
  type: string
}

// LSP defaults
export namespace CompletionItemKind {
  export const Text = 1;
  export const Method = 2;
  export const Function = 3;
  export const Constructor = 4;
  export const Field = 5;
  export const Variable = 6;
  export const Class = 7;
  export const Interface = 8;
  export const Module = 9;
  export const Property = 10;
  export const Unit = 11;
  export const Value = 12;
  export const Enum = 13;
  export const Keyword = 14;
  export const Snippet = 15;
  export const Color = 16;
  export const File = 17;
  export const Reference = 18;
  export const Folder = 19;
  export const EnumMember = 20;
  export const Constant = 21;
  export const Struct = 22;
  export const Event = 23;
  export const Operator = 24;
  export const TypeParameter = 25;
}


export const itemKinds: Record<number, string> = {};

for(let key of Object.keys(CompletionItemKind)) {
  // @ts-ignore
  itemKinds[CompletionItemKind[key]] = key;
}

/**
 * A namespace for Private functionality.
 */
namespace Private {
  /**
   * Get a list of completion hints from a tokenization
   * of the editor.
   */
  export async function hint(
    editor: CodeEditor.IEditor,
    connection: LspWsConnection,
    completion_characters: Array<string>
  ): Promise<CompletionHandler.IReply> {
    // Find the token at the cursor
    const cursor = editor.getCursorPosition();
    const token = editor.getTokenForPosition(cursor);

    const start = editor.getPositionAt(token.offset);
    const end = editor.getPositionAt(token.offset + token.value.length);

    // const signatureCharacters = connection.getLanguageSignatureCharacters();

    const typedCharacter = token.value[cursor.column - start.column - 1];

    // without sendChange we (sometimes) get outdated suggestions
    connection.sendChange();

    //let request_completion: Function;
    let event: string;

    // nope - do not do this; we need to get the signature (yes)
    // but only in order to bump the priority of the parameters!
    // unfortunately there is no abstraction of scores exposed
    // to the matches...
    // Suggested in https://github.com/jupyterlab/jupyterlab/issues/7044, TODO PR


    //if (signatureCharacters.indexOf(typedCharacter) !== -1) {
    //  // @ts-ignore
    //  request_completion = connection.getSignatureHelp.bind(this);
    //  event = 'signature'
    //} else {
    // @ts-ignore
    //request_completion = connection.getCompletion.bind(this);
    event = 'completion';
    //}
    //*/

    // todo: regexpr?
    //if(completion_characters.indexOf(typedCharacter) === -1)
    //  return

    // in Node v11.13.0, once() was added which would enable using native promises here:
    // https://nodejs.org/api/events.html#events_events_once_emitter_name
    // but it has not been implemented in 'events':
    // https://nodejs.org/api/events.html
    // yet (as for today they match Node.js v10.1)
    // There is an issue:
    // https://github.com/Gozala/events/issues/63

    connection.getCompletion(
      convert_position(cursor),
      {
        start: convert_position(start),
        end: convert_position(end),
        text: token.value
      },
      //completion_characters.find((c) => c === typedCharacter)
      typedCharacter,
      //lsProtocol.CompletionTriggerKind.TriggerCharacter,
    );
    let result: any = {set: false};
    connection.once(event, (args: any) => {
      result.value = args;
      result.set = true;
      return args
    });
    await once_set(result);

    console.log(result);

    let matches: Array<string> = [];
    const types: Array<IItemType> = [];

    let no_prefix = true;
    for (let match of result.value) {
      // there are more interesting things to be extracted and passed to the metadata:
      // detail: "__main__"
      // documentation: "mean(data)↵↵Return the sample arithmetic mean of data.↵↵>>> mean([1, 2, 3, 4, 4])↵2.8↵↵>>> from fractions import Fraction as F↵>>> mean([F(3, 7), F(1, 21), F(5, 3), F(1, 3)])↵Fraction(13, 21)↵↵>>> from decimal import Decimal as D↵>>> mean([D("0.5"), D("0.75"), D("0.625"), D("0.375")])↵Decimal('0.5625')↵↵If ``data`` is empty, StatisticsError will be raised."
      // insertText: "mean"
      // kind: 3
      // label: "mean(data)"
      // sortText: "amean"
      let text = match.insertText ? match.insertText : match.label;
      if (text.toLowerCase().startsWith(token.value.toLowerCase())) {
        no_prefix = false;
      }

      matches.push(text);
      types.push({
        text: text,
        type: match.kind ? itemKinds[match.kind] : ''
      })
    }
    console.log(matches)
    console.log(types)

    return {
      // note in the ContextCompleter it was:
      // start: token.offset,
      // end: token.offset + token.value.length,
      // which does not work with "from statistics import <tab>" as the last token ends at "t" of "import",
      // so the completer would append "mean" as "from statistics importmean" (without space!);
      // (in such a case the typedCharacters is undefined as we are out of range)
      // a different workaround would be to prepend the token.value prefix:
      // text = token.value + text;
      // but it did not work for "from statistics <tab>" and lead to "from statisticsimport" (no space)
      start: no_prefix ? token.offset + token.value.length : token.offset,
      end: token.offset + token.value.length,
      matches: matches,
      metadata: {
        _jupyter_types_experimental: types
      }
    };
  }

}
