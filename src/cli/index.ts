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
import { existsSync, readFileSync, writeFileSync } from "fs";
import { checkbox, confirm, input, select } from "@inquirer/prompts";
import { RX_RESUME_TOOLS } from "../rx-resume/index.ts";
import { PromptCancelled, runCli } from "./run-cli.ts";
import type { Prompter } from "./types.ts";

/** Today's date in the local time zone, as `YYYY-MM-DD`. */
function localToday(): string {
  const currentDate = new Date();
  const twoDigits = (datePart: number): string =>
    String(datePart).padStart(2, "0");
  const year = currentDate.getFullYear();
  const month = twoDigits(currentDate.getMonth() + 1);
  const day = twoDigits(currentDate.getDate());
  return `${year}-${month}-${day}`;
}

/** Error names the prompt library uses. Its README checks Ctrl+C by name. */
enum InquirerError {
  Exit = "ExitPromptError",
}

/** Rethrows the library's Ctrl+C error as the CLI's own. */
async function cancellable<TValue>(
  pendingPrompt: Promise<TValue>,
): Promise<TValue> {
  try {
    return await pendingPrompt;
  } catch (error) {
    if (error instanceof Error && error.name === InquirerError.Exit) {
      throw new PromptCancelled();
    }
    throw error;
  }
}

/** Adapts the prompt library to the CLI's Prompter; it calls a question its `message`. */
const prompter: Prompter = {
  select: ({ question, choices }) =>
    cancellable(select({ message: question, choices: [...choices] })),
  input: ({ question, validate }) =>
    cancellable(input({ message: question, validate })),
  checkbox: ({ question, choices }) =>
    cancellable(checkbox({ message: question, choices: [...choices] })),
  confirm: ({ question, default: fallback }) =>
    cancellable(confirm({ message: question, default: fallback })),
};

process.exit(
  await runCli({
    commandLineArguments: process.argv.slice(2),
    tools: RX_RESUME_TOOLS,
    prompter,
    environmentVariables: process.env,
    isInteractiveTerminal: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    workingDirectory: process.cwd(),
    exists: existsSync,
    fetch: globalThis.fetch,
    newId: randomUUID,
    today: localToday,
    now: () => performance.now(),
    readFile: (absolutePath) => readFileSync(absolutePath, "utf-8"),
    writeFile: (absolutePath, bytes) => writeFileSync(absolutePath, bytes),
    log: (line) => console.log(line),
    logError: (line) => console.error(line),
  }),
);
