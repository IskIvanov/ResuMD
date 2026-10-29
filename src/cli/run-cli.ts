/**
 * run-cli.ts
 *
 * The CLI flow. With command-line arguments, runs the tool they name
 * directly: `bun run cli <tool id> [flags]`. Without, runs the interactive
 * menu: menu → options → print command → confirm → run. Every dependency is
 * injected and the result is an exit code, so both modes run in tests without
 * a terminal or process.exit.
 */

import { describeCaught } from "../utils/error.ts";
import type { EnvironmentVariables } from "../utils/types.ts";
import { promptOptions } from "./prompt.ts";
import {
  type Choice,
  type CliDependencies,
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

/** Wraps a word in double quotes when the shell would split or expand it. */
function quoteForShell(word: string): string {
  if (SAFE_WORD.test(word)) return word;
  return `"${word.replace(/(["\\$`])/g, "\\$1")}"`;
}

/**
 * Joins a command and its tool arguments into one copy-pasteable shell line,
 * so the user sees (and can reuse) exactly what is about to run.
 */
function formatCommand(
  command: string,
  toolArguments: readonly string[],
): string {
  return [command, ...toolArguments.map(quoteForShell)].join(" ");
}

/** Lists a tool, disabled with the reason when its preflight fails. */
function toToolChoice(
  tool: ToolDefinition,
  environmentVariables: EnvironmentVariables,
): Choice<MenuValue> {
  const choice: Choice<MenuValue> = {
    name: `${tool.title} — ${tool.description}`,
    value: tool,
  };
  const reason = tool.preflight?.(environmentVariables);
  if (!reason) return choice;
  return { ...choice, disabled: `Not available: ${reason}` };
}

/**
 * Builds the select choices for the tool menu.
 *
 * @param tools - The registered tools, in menu order.
 * @param environmentVariables - Passed to each tool's preflight.
 * @returns Each tool, disabled with the reason when it can't run, then Exit.
 *
 * @example
 * buildMenu([deleteResumeTool], process.env);
 * // [{ name: "Delete resume — …", value: deleteResumeTool },
 * //  { name: "Exit", value: MenuAction.Exit }]
 */
export function buildMenu(
  tools: readonly ToolDefinition[],
  environmentVariables: EnvironmentVariables,
): Choice<MenuValue>[] {
  return [
    ...tools.map((tool) => toToolChoice(tool, environmentVariables)),
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

/** Runs the tool named by the first command-line argument with the rest. */
async function runNamedTool(dependencies: CliDependencies): Promise<ExitCode> {
  const [toolId, ...toolArguments] = dependencies.commandLineArguments;
  const tool = dependencies.tools.find((candidate) => candidate.id === toolId);
  if (!tool) {
    const heading = `Unknown tool "${toolId}". Run one of:`;
    dependencies.logError(usageHelp(heading, dependencies.tools));
    return ExitCode.Failure;
  }

  await tool.run(toolArguments, dependencies);
  return ExitCode.Success;
}

/** Runs the menu until a tool has run or the user exits. */
async function menuLoop(dependencies: CliDependencies): Promise<ExitCode> {
  const { tools, prompter, environmentVariables, log } = dependencies;

  for (;;) {
    const menuSelection = await prompter.select<MenuValue>({
      question: "Which tool do you want to run?",
      choices: buildMenu(tools, environmentVariables),
    });
    if (menuSelection === MenuAction.Exit) return ExitCode.Success;

    const toolArguments = await promptOptions(
      menuSelection.options,
      prompter,
      dependencies,
    );
    log(formatCommand(menuSelection.command, toolArguments));

    const confirmed = await prompter.confirm({
      question: "Run it?",
      default: true,
    });
    if (!confirmed) continue;

    await menuSelection.run(toolArguments, dependencies);
    return ExitCode.Success;
  }
}

/**
 * Runs the CLI once: the named tool directly, or the interactive menu.
 *
 * @param dependencies - Command-line arguments, tools, prompter, environment
 *   variables and output sinks; also what each tool runs with.
 * @returns `Success` after a tool ran or Exit was picked, `Failure` for an
 *   unknown tool, a menu without a terminal, or a tool that threw, and
 *   `Cancelled` on Ctrl+C.
 *
 * @example
 * process.exit(
 *   await runCli({ commandLineArguments: process.argv.slice(2), tools, … }),
 * );
 */
export async function runCli(dependencies: CliDependencies): Promise<ExitCode> {
  try {
    if (dependencies.commandLineArguments.length > 0) {
      return await runNamedTool(dependencies);
    }
    if (!dependencies.isInteractiveTerminal) {
      dependencies.logError(
        usageHelp(
          "resume-tools cli needs an interactive terminal. Run a tool directly:",
          dependencies.tools,
        ),
      );
      return ExitCode.Failure;
    }
    return await menuLoop(dependencies);
  } catch (error) {
    if (error instanceof PromptCancelled) {
      dependencies.logError("Cancelled.");
      return ExitCode.Cancelled;
    }
    dependencies.logError(describeFailure(error));
    return ExitCode.Failure;
  }
}
