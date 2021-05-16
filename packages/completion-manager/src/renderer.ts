import { Completer, CompletionHandler } from '@jupyterlab/completer';

import { ICompletionProvider, IExtendedCompletionItem } from './tokens';

export class DispatchRenderer
  extends Completer.Renderer
  implements Completer.IRenderer {
  constructor(protected providers: Map<string, ICompletionProvider>) {
    super();
  }

  createCompletionItemNode(
    item: IExtendedCompletionItem | CompletionHandler.ICompletionItem,
    orderedTypes: string[]
  ): HTMLLIElement {
    // if there is no provider: use default renderer
    if (!(<IExtendedCompletionItem>item).provider) {
      return super.createCompletionItemNode(item, orderedTypes);
    }
    // otherwise we must have an extended item.
    let extItem = item as IExtendedCompletionItem;

    // make sure that an instance reference, and not an object copy is being used;
    if (extItem.self) {
      extItem = extItem.self;
    }

    if (extItem.provider.renderer) {
      return extItem.provider.renderer.createCompletionItemNode(
        extItem,
        orderedTypes
      );
    }

    return super.createCompletionItemNode(item, orderedTypes);
  }

  createDocumentationNode(
    item: IExtendedCompletionItem | CompletionHandler.ICompletionItem
  ): HTMLElement {
    // if there is no provider: use default renderer
    if (!(<IExtendedCompletionItem>item).provider) {
      // TODO: add super() here (once new version upstream released)
      return;
    }
    // otherwise we must have an extended item.
    let extItem = item as IExtendedCompletionItem;

    // make sure that an instance reference, and not an object copy is being used;
    if (extItem.self) {
      extItem = extItem.self;
    }

    if (extItem.provider.renderer) {
      return extItem.provider.renderer.createDocumentationNode(extItem);
    }

    // TODO: add super() here (once new version upstream released)
  }
}
