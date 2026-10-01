/**
 * cli/index.ts
 *
 * Entry point for `bun run cli`. The only file that imports the prompt library
 * or touches the real terminal, environment and file system; everything else
 * runs through runCli with injected dependencies.
 *
 * Run: bun src/cli/index.ts                      (interactive menu)
 *      bun src/cli/index.ts <tool id> [flags]    (one tool, no prompts)
 */

import { existsSync } from "fs";
import { checkbox, confirm, input, select, Separator } from "@inquirer/prompts";
import { PromptCancelledError } from "./errors.ts";
import { TOOLS } from "./registry.ts";
import { runCli } from "./run-cli.ts";
import type { Choice, MenuItem, Prompter } from "./types.ts";

/** Error names the prompt library uses. Its README checks Ctrl+C by name. */
enum InquirerError {
  Exit = "ExitPromptError",
}

/** Rethrows the library's Ctrl+C error as the CLI's own. */
async function cancellable<TValue>(prompt: Promise<TValue>): Promise<TValue> {
  try {
    return await prompt;
  } catch (error) {
    if (error instanceof Error && error.name === InquirerError.Exit) {
      throw new PromptCancelledError();
    }
    throw error;
  }
}

/** Maps a CLI menu item to the library's choice or Separator. */
function toSelectItem<TValue>(
  item: MenuItem<TValue>,
): Choice<TValue> | Separator {
  return "separator" in item ? new Separator(item.separator) : item;
}

const prompter: Prompter = {
  select: ({ message, choices }) =>
    cancellable(select({ message, choices: choices.map(toSelectItem) })),
  input: ({ message, validate }) => cancellable(input({ message, validate })),
  checkbox: ({ message, choices }) =>
    cancellable(checkbox({ message, choices: [...choices] })),
  confirm: ({ message, default: fallback }) =>
    cancellable(confirm({ message, default: fallback })),
};

process.exit(
  await runCli({
    argv: process.argv.slice(2),
    tools: TOOLS,
    prompter,
    env: process.env,
    isTTY: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    pathContext: { cwd: process.cwd(), exists: existsSync },
    log: (line) => console.log(line),
    logError: (line) => console.error(line),
  }),
);
