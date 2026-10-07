/**
 * run-cli.ts
 *
 * The CLI flow. With arguments, runs the tool they name directly:
 * `bun run cli <tool id> [flags]`. Without, runs the interactive menu:
 * menu → options → print command → confirm → run. Every dependency is
 * injected and the result is an exit code, so both modes run in tests without
 * a terminal or process.exit.
 */

import { formatCommand } from "./command.ts";
import { isCliError } from "./errors.ts";
import { buildMenu, type MenuValue } from "./menu.ts";
import { promptOptions } from "./prompt-options.ts";
import {
  CliErrorCode,
  CliLabel,
  ExitCode,
  MenuAction,
  type Env,
  type PathContext,
  type Prompter,
  type RunContext,
  type ToolDefinition,
} from "./types.ts";

/** Everything runCli reads from or writes to the outside world. */
export interface CliDeps {
  /** Arguments after the script name; empty opens the menu. */
  argv: readonly string[];
  tools: readonly ToolDefinition[];
  prompter: Prompter;
  env: Env;
  isTTY: boolean;
  pathContext: PathContext;
  log: (line: string) => void;
  logError: (line: string) => void;
}

/** Lists every tool's usage under a heading. */
function usageHelp(heading: string, tools: readonly ToolDefinition[]): string {
  return [heading, ...tools.map((tool) => `  ${tool.usage}`)].join("\n");
}

/** The directory and environment a tool runs with. */
function runContext(deps: CliDeps): RunContext {
  return { cwd: deps.pathContext.cwd, env: deps.env };
}

/** Runs the tool named by the first argument with the remaining flags. */
async function runDirect(deps: CliDeps): Promise<ExitCode> {
  const [id, ...argv] = deps.argv;
  const tool = deps.tools.find((candidate) => candidate.id === id);
  if (!tool) {
    const heading = `${CliLabel.UnknownTool} "${id}". ${CliLabel.RunOneOf}`;
    deps.logError(usageHelp(heading, deps.tools));
    return ExitCode.Failure;
  }

  await tool.run(argv, runContext(deps));
  return ExitCode.Success;
}

/** Runs the menu until a tool has run or the user exits. */
async function menuLoop(deps: CliDeps): Promise<ExitCode> {
  const { tools, prompter, env, pathContext, log } = deps;

  for (;;) {
    const picked = await prompter.select<MenuValue>({
      message: CliLabel.PickTool,
      choices: buildMenu(tools, env),
    });
    if (picked === MenuAction.Exit) return ExitCode.Success;

    const argv = await promptOptions(picked.options, prompter, pathContext);
    log(formatCommand(picked.command, argv));

    const confirmed = await prompter.confirm({
      message: CliLabel.RunIt,
      default: true,
    });
    if (!confirmed) continue;

    await picked.run(argv, runContext(deps));
    return ExitCode.Success;
  }
}

/**
 * Runs the CLI once: the named tool directly, or the interactive menu.
 *
 * @param deps - Arguments, tools, prompter, environment and output sinks.
 * @returns `Success` after a tool ran or Exit was picked, `Failure` for an
 *   unknown tool, a menu without a terminal, or a tool that threw, and
 *   `Cancelled` on Ctrl+C.
 *
 * @example
 * process.exit(await runCli({ argv: process.argv.slice(2), tools: TOOLS, … }));
 */
export async function runCli(deps: CliDeps): Promise<ExitCode> {
  try {
    if (deps.argv.length > 0) return await runDirect(deps);
    if (!deps.isTTY) {
      deps.logError(usageHelp(CliLabel.NeedsTerminal, deps.tools));
      return ExitCode.Failure;
    }
    return await menuLoop(deps);
  } catch (error) {
    if (isCliError(error, CliErrorCode.PromptCancelled)) {
      deps.logError(CliLabel.Cancelled);
      return ExitCode.Cancelled;
    }
    deps.logError(error instanceof Error ? error.message : String(error));
    return ExitCode.Failure;
  }
}
