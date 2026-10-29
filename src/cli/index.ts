/**
 * cli/index.ts
 *
 * Entry point for `bun run cli`. The only file that imports the prompt library
 * or touches the real terminal, environment, network, clock and file system;
 * everything else runs through runCli with injected dependencies.
 *
 * Run: bun src/cli/index.ts                      (interactive menu)
 *      bun src/cli/index.ts <tool id> [flags]    (one tool, no prompts)
 */

import { randomUUID } from "crypto";
import { existsSync, readFileSync } from "fs";
import { checkbox, confirm, input, select } from "@inquirer/prompts";
import { RX_RESUME_TOOLS } from "../rx-resume/index.ts";
import { PromptCancelled, runCli } from "./run-cli.ts";
import type { Prompter } from "./types.ts";

/** Today's date in the local time zone, as `YYYY-MM-DD`. */
function localToday(): string {
  const now = new Date();
  const pad = (part: number): string => String(part).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

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
      throw new PromptCancelled();
    }
    throw error;
  }
}

const prompter: Prompter = {
  select: ({ message, choices }) =>
    cancellable(select({ message, choices: [...choices] })),
  input: ({ message, validate }) => cancellable(input({ message, validate })),
  checkbox: ({ message, choices }) =>
    cancellable(checkbox({ message, choices: [...choices] })),
  confirm: ({ message, default: fallback }) =>
    cancellable(confirm({ message, default: fallback })),
};

process.exit(
  await runCli({
    argv: process.argv.slice(2),
    tools: RX_RESUME_TOOLS,
    prompter,
    env: process.env,
    isTTY: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    cwd: process.cwd(),
    exists: existsSync,
    fetch: globalThis.fetch,
    newId: randomUUID,
    today: localToday,
    now: () => performance.now(),
    readFile: (absolutePath) => readFileSync(absolutePath, "utf-8"),
    log: (line) => console.log(line),
    logError: (line) => console.error(line),
  }),
);
