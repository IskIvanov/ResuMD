/**
 * errors.ts
 *
 * Errors the CLI owns, so run-cli.ts can tell them apart without importing a
 * prompt library.
 */

/** Thrown by a Prompter when the user cancels a prompt (Ctrl+C). */
export class PromptCancelledError extends Error {
  constructor() {
    super("Prompt cancelled");
    this.name = "PromptCancelledError";
  }
}
