/** reproduced here to avoid imports */
export namespace CompletionTriggerKind {
  /**
   * Completion was triggered by typing an identifier (24x7 code
   * complete), manual invocation (e.g Ctrl+Space) or via API.
   */
  export const Invoked: 1 = 1;

  /**
   * Completion was triggered by a trigger character specified by
   * the `triggerCharacters` properties of the `CompletionRegistrationOptions`.
   */
  export const TriggerCharacter: 2 = 2;

  /**
   * Completion was re-triggered as the current completion list is incomplete.
   */
  export const TriggerForIncompleteCompletions: 3 = 3;
}

export type CompletionTriggerKind = 1 | 2 | 3;
