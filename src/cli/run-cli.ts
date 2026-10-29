/**
 * run-cli.ts
 *
 * The CLI flow. With arguments, runs the tool they name directly:
 * `bun run cli <tool id> [flags]`. Without, runs the interactive menu:
 * menu → options → print command → confirm → run. Every dependency is
 * injected and the result is an exit code, so both modes run in tests without
 * a terminal or process.exit.
 */

import { describeCaught } from "../utils/error.ts";
import type { Env } from "../utils/types.ts";
import { promptOptions } from "./prompt.ts";
import {
  type Choice,
  type CliDeps,
  ExitCode,
  MenuAction,
  type MenuValue,
  type ToolDefinition,
} from "./types.ts";

/**
 * Thrown when the user cancels a prompt (Ctrl+C), so runCli can exit with
 * 130 without importing a prompt library.
 *
 * @example
 * throw new PromptCancelled();
 */
export class PromptCancelled extends Error {
  constructor() {
    super("Prompt cancelled");
    this.name = "PromptCancelled";
  }
}

/** Characters that are safe in a shell word without quoting. */
const SAFE_WORD = /^[\w@%+=:,./-]+$/;

/** Wraps a value in double quotes when the shell would split or expand it. */
function quote(value: string): string {
  if (SAFE_WORD.test(value)) return value;
  return `"${value.replace(/(["\\$`])/g, "\\$1")}"`;
}

/**
 * Joins a command and its argv into one copy-pasteable shell line, so the
 * user sees (and can reuse) exactly what is about to run.
 */
function formatCommand(command: string, argv: readonly string[]): string {
  return [command, ...argv.map(quote)].join(" ");
}

/** Lists a tool, disabled with the reason when its preflight fails. */
function toToolChoice(tool: ToolDefinition, env: Env): Choice<MenuValue> {
  const choice: Choice<MenuValue> = {
    name: `${tool.title} — ${tool.description}`,
    value: tool,
  };
  const reason = tool.preflight?.(env);
  if (!reason) return choice;
  return { ...choice, disabled: `Not available: ${reason}` };
}

/**
 * Builds the select choices for the tool menu.
 *
 * @param tools - The registered tools, in menu order.
 * @param env - Passed to each tool's preflight.
 * @returns Each tool, disabled with the reason when it can't run, then Exit.
 *
 * @example
 * buildMenu([deleteResumeTool], process.env);
 * // [{ name: "Delete resume — …", value: deleteResumeTool },
 * //  { name: "Exit", value: MenuAction.Exit }]
 */
export function buildMenu(
  tools: readonly ToolDefinition[],
  env: Env,
): Choice<MenuValue>[] {
  return [
    ...tools.map((tool) => toToolChoice(tool, env)),
    { name: "Exit", value: MenuAction.Exit },
  ];
}

/** Lists every tool's usage under a heading. */
function usageHelp(heading: string, tools: readonly ToolDefinition[]): string {
  return [heading, ...tools.map((tool) => `  ${tool.usage}`)].join("\n");
}

/**
 * A thrown value's message, then each `cause` under it, skipping a cause the
 * lines above already state.
 */
function describeFailure(error: unknown): string {
  const lines = [describeCaught(error)];
  let cause = error instanceof Error ? error.cause : undefined;
  while (cause !== undefined) {
    const line = describeCaught(cause);
    if (!lines.some((shown) => shown.includes(line))) {
      lines.push(`  caused by: ${line}`);
    }
    cause = cause instanceof Error ? cause.cause : undefined;
  }
  return lines.join("\n");
}

/** Runs the tool named by the first argument with the remaining flags. */
async function runDirect(deps: CliDeps): Promise<ExitCode> {
  const [id, ...argv] = deps.argv;
  const tool = deps.tools.find((candidate) => candidate.id === id);
  if (!tool) {
    const heading = `Unknown tool "${id}". Run one of:`;
    deps.logError(usageHelp(heading, deps.tools));
    return ExitCode.Failure;
  }

  await tool.run(argv, deps);
  return ExitCode.Success;
}

/** Runs the menu until a tool has run or the user exits. */
async function menuLoop(deps: CliDeps): Promise<ExitCode> {
  const { tools, prompter, env, log } = deps;

  for (;;) {
    const picked = await prompter.select<MenuValue>({
      message: "Which tool do you want to run?",
      choices: buildMenu(tools, env),
    });
    if (picked === MenuAction.Exit) return ExitCode.Success;

    const argv = await promptOptions(picked.options, prompter, deps);
    log(formatCommand(picked.command, argv));

    const confirmed = await prompter.confirm({
      message: "Run it?",
      default: true,
    });
    if (!confirmed) continue;

    await picked.run(argv, deps);
    return ExitCode.Success;
  }
}

/**
 * Runs the CLI once: the named tool directly, or the interactive menu.
 *
 * @param deps - Arguments, tools, prompter, environment and output sinks;
 *   also the context each tool runs with.
 * @returns `Success` after a tool ran or Exit was picked, `Failure` for an
 *   unknown tool, a menu without a terminal, or a tool that threw, and
 *   `Cancelled` on Ctrl+C.
 *
 * @example
 * process.exit(await runCli({ argv: process.argv.slice(2), tools, … }));
 */
export async function runCli(deps: CliDeps): Promise<ExitCode> {
  try {
    if (deps.argv.length > 0) return await runDirect(deps);
    if (!deps.isTTY) {
      deps.logError(
        usageHelp(
          "resume-tools cli needs an interactive terminal. Run a tool directly:",
          deps.tools,
        ),
      );
      return ExitCode.Failure;
    }
    return await menuLoop(deps);
  } catch (error) {
    if (error instanceof PromptCancelled) {
      deps.logError("Cancelled.");
      return ExitCode.Cancelled;
    }
    deps.logError(describeFailure(error));
    return ExitCode.Failure;
  }
}
