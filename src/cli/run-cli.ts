/**
 * run-cli.ts
 *
 * The CLI flow. With command-line arguments, runs the tool they name
 * directly: `bun run cli <tool id> [flags]`. Without, runs the interactive
 * menu: menu → options → print command → confirm → run. Every dependency is
 * injected and the result is an exit code, so both modes run in tests without
 * a terminal or process.exit.
 */

import { parseEnv } from "util";
import { describeCaught } from "../utils/error.ts";
import type { EnvironmentVariables } from "../utils/types.ts";
import { promptOptions } from "./prompt.ts";
import {
  type Choice,
  type CliDependencies,
  ExitCode,
  MenuAction,
  type FirstLevelValue,
  type PlatformLevelValue,
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

/** What the printed command shows in place of a secret answer. */
const SECRET_MASK = "••••••••";

/** The flags, with their dashes, whose answers are secret. */
function secretFlagsOf(tool: ToolDefinition): Set<string> {
  const secretOptions = tool.options.filter(
    (option) => "secret" in option && option.secret === true,
  );
  return new Set(secretOptions.map((option) => `--${option.flag}`));
}

/**
 * Joins a tool's command and its tool arguments into one copy-pasteable
 * shell line, so the user sees (and can reuse) exactly what is about to run.
 * A secret answer is shown as SECRET_MASK, so it stays off the screen.
 */
function formatCommand(
  tool: ToolDefinition,
  toolArguments: readonly string[],
): string {
  const secretFlags = secretFlagsOf(tool);
  const shownArguments = toolArguments.map((word, position) => {
    if (secretFlags.has(toolArguments[position - 1] ?? "")) return SECRET_MASK;
    return quoteForShell(word);
  });
  return [tool.command, ...shownArguments].join(" ");
}

/** Lists a tool, disabled with the reason when its preflight fails. */
function toToolChoice(
  tool: ToolDefinition,
  environmentVariables: EnvironmentVariables,
): Choice<ToolDefinition> {
  const choice: Choice<ToolDefinition> = {
    name: `${tool.title} — ${tool.description}`,
    value: tool,
  };
  const reason = tool.preflight?.(environmentVariables);
  if (!reason) return choice;
  return { ...choice, disabled: `Not available: ${reason}` };
}

/** Each tool's platform, once, in order of first appearance. */
function platformsOf(tools: readonly ToolDefinition[]): string[] {
  const platforms = tools
    .map((tool) => tool.platform)
    .filter((platform): platform is string => platform !== undefined);
  return [...new Set(platforms)];
}

/**
 * Builds the select choices for the first menu level.
 *
 * @param tools - The registered tools, in menu order.
 * @param environmentVariables - Passed to the preflight of each tool that
 *   needs no platform.
 * @returns Each platform in order of first appearance, then each tool that
 *   needs no platform, disabled with the reason when it can't run, then Exit.
 *
 * @example
 * buildMenu([...RX_RESUME_TOOLS, exampleResumeTool], process.env);
 * // [{ name: "Reactive Resume", value: { platform: "Reactive Resume" } },
 * //  { name: "Example resume — …", value: exampleResumeTool },
 * //  { name: "Exit", value: MenuAction.Exit }]
 */
export function buildMenu(
  tools: readonly ToolDefinition[],
  environmentVariables: EnvironmentVariables,
): Choice<FirstLevelValue>[] {
  const platformChoices = platformsOf(tools).map((platform) => ({
    name: platform,
    value: { platform },
  }));
  const toolChoices = tools
    .filter((tool) => tool.platform === undefined)
    .map((tool) => toToolChoice(tool, environmentVariables));
  return [
    ...platformChoices,
    ...toolChoices,
    { name: "Exit", value: MenuAction.Exit },
  ];
}

/**
 * Builds the select choices for one platform's tools.
 *
 * @param platform - The platform's label, e.g. "Reactive Resume".
 * @param tools - The registered tools; only that platform's are listed.
 * @param environmentVariables - Passed to each tool's preflight.
 * @returns The platform's tools in registry order, each disabled with the
 *   reason when it can't run, then Back and Exit.
 *
 * @example
 * buildPlatformMenu("Reactive Resume", RX_RESUME_TOOLS, process.env);
 * // [{ name: "Connect Reactive Resume — …", value: connectRxResumeTool },
 * //  …, { name: "Back", value: MenuAction.Back },
 * //  { name: "Exit", value: MenuAction.Exit }]
 */
export function buildPlatformMenu(
  platform: string,
  tools: readonly ToolDefinition[],
  environmentVariables: EnvironmentVariables,
): Choice<PlatformLevelValue>[] {
  return [
    ...tools
      .filter((tool) => tool.platform === platform)
      .map((tool) => toToolChoice(tool, environmentVariables)),
    { name: "Back", value: MenuAction.Back },
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

/**
 * The settings Connect saved, with the environment variables over them: the
 * shell's, and a `.env` in the current folder, which Bun loads. An empty
 * value, such as `RXRESUME_API_KEY=` copied from `.env.example`, doesn't hide
 * a saved one.
 */
function withSavedSettings(
  dependencies: CliDependencies,
): EnvironmentVariables {
  const { settingsFile, environmentVariables } = dependencies;
  if (!dependencies.exists(settingsFile)) return environmentVariables;
  const savedSettings = parseEnv(dependencies.readFile(settingsFile));
  const givenSettings = Object.entries(environmentVariables).filter(
    ([, value]) => value !== "",
  );
  return { ...savedSettings, ...Object.fromEntries(givenSettings) };
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

/**
 * Asks which tool to run: a platform and then one of its tools, or a tool
 * that needs no platform. Back in a platform's menu asks again from the top.
 */
async function pickTool(
  dependencies: CliDependencies,
): Promise<ToolDefinition | MenuAction.Exit> {
  const { tools, prompter, environmentVariables } = dependencies;

  for (;;) {
    const firstLevelPick = await prompter.select<FirstLevelValue>({
      question: "Select a platform from the list?",
      choices: buildMenu(tools, environmentVariables),
    });
    if (firstLevelPick === MenuAction.Exit || "id" in firstLevelPick) {
      return firstLevelPick;
    }

    const { platform } = firstLevelPick;
    const platformPick = await prompter.select<PlatformLevelValue>({
      question: `Which ${platform} tool?`,
      choices: buildPlatformMenu(platform, tools, environmentVariables),
    });
    if (platformPick !== MenuAction.Back) return platformPick;
  }
}

/** Runs the menu until a tool has run or the user exits. */
async function menuLoop(dependencies: CliDependencies): Promise<ExitCode> {
  const { prompter, log } = dependencies;

  for (;;) {
    const tool = await pickTool(dependencies);
    if (tool === MenuAction.Exit) return ExitCode.Success;

    const toolArguments = await promptOptions(
      tool.options,
      prompter,
      dependencies,
    );
    log(formatCommand(tool, toolArguments));

    const confirmed = await prompter.confirm({
      question: "Run it?",
      default: true,
    });
    if (!confirmed) continue;

    await tool.run(toolArguments, dependencies);
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
export async function runCli(
  cliDependencies: CliDependencies,
): Promise<ExitCode> {
  try {
    const dependencies: CliDependencies = {
      ...cliDependencies,
      environmentVariables: withSavedSettings(cliDependencies),
    };
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
      cliDependencies.logError("Cancelled.");
      return ExitCode.Cancelled;
    }
    cliDependencies.logError(describeFailure(error));
    return ExitCode.Failure;
  }
}
