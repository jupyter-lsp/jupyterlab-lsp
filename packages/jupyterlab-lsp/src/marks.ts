import { StateField, StateEffect } from '@codemirror/state';
import { EditorView, Decoration, DecorationSet } from '@codemirror/view';

export interface IMark<Kinds> {
  from: number;
  to: number;
  kind: Kinds;
}

/**
 * Manage marks in multiple editor views (e.g. cells).
 */
export interface ISimpleMarkManager<Kinds> {
  putMarks(view: EditorView, positions: IMark<Kinds>[]): void;
  /**
   * Clear marks from all editor views.
   */
  clearAllMarks(): void;
  clearEditorMarks(view: EditorView): void;
}

export type MarkDecorationSpec = Parameters<typeof Decoration.mark>[0] & {
  class: string;
};

namespace Private {
  export let specCounter = 0;
}

export function createMarkManager<Kinds extends string | number>(
  specs: Record<Kinds, MarkDecorationSpec>
): ISimpleMarkManager<Kinds> {
  const specId = ++Private.specCounter;
  const kindToMark = Object.fromEntries(
    Object.entries(specs).map(([k, spec]) => [
      k as Kinds,
      Decoration.mark({
        ...(spec as MarkDecorationSpec),
        _id: Private.specCounter
      })
    ])
  ) as Record<Kinds, Decoration>;

  const addMark = StateEffect.define<IMark<Kinds>>({
    map: ({ from, to, kind }, change) => ({
      from: change.mapPos(from),
      to: change.mapPos(to),
      kind
    })
  });

  const removeMark = StateEffect.define<null>();

  const markField = StateField.define<DecorationSet>({
    create() {
      return Decoration.none;
    },
    update(marks, tr) {
      marks = marks.map(tr.changes);
      for (let e of tr.effects) {
        if (e.is(addMark)) {
          marks = marks.update({
            add: [
              kindToMark[e.value.kind].range(
                Math.min(e.value.from, tr.newDoc.length - 1),
                Math.min(e.value.to, tr.newDoc.length - 1)
              )
            ]
          });
        } else if (e.is(removeMark)) {
          marks = marks.update({
            filter: (from, to, value) => {
              return value.spec['_id'] !== specId;
            }
          });
        }
      }
      return marks;
    },
    provide: f => EditorView.decorations.from(f)
  });
  const views = new Set<EditorView>();

  return {
    putMarks(view: EditorView, positions: IMark<Kinds>[]) {
      const effects: StateEffect<unknown>[] = positions.map(position =>
        addMark.of(position)
      );

      if (!view.state.field(markField, false)) {
        effects.push(StateEffect.appendConfig.of([markField]));
      }
      view.dispatch({ effects });
      views.add(view);
    },
    clearAllMarks() {
      for (let view of views) {
        this.clearEditorMarks(view);
      }
      views.clear();
    },
    clearEditorMarks(view: EditorView) {
      const effects: StateEffect<unknown>[] = [removeMark.of(null)];
      view.dispatch({ effects });
    }
  };
}
