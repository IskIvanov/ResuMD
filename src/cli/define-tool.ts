/**
 * define-tool.ts
 *
 * Turns a tool's declared options into everything both ways of running it
 * need: the menu's option list, the usage line and one argv parser. A tool
 * declares each option once and its run receives typed values, so the menu
 * and the direct command can't drift apart.
 */

import { resolve } from "path";
import { parseArgs } from "util";
import {
  CliLabel,
  OptionKind,
  type OptionDescriptor,
  type OptionSpecs,
  type OptionValues,
  type ToolDefinition,
  type ToolSpec,
} from "./types.ts";

/** The direct command; a tool runs as `bun run cli <tool id> [flags]`. */
export const CLI_COMMAND = "bun run cli";

/** Every flag takes a string value; kinds are converted after parsing. */
const STRING_FLAG = { type: "string" } as const;

/**
 * Lists a tool's options with their flags, in declaration order.
 *
 * @param options - The options keyed by flag.
 * @returns One descriptor per option.
 *
 * @example
 * toOptionDescriptors({ id: { kind: OptionKind.Text, required: true, message: "Id" } });
 * // [{ flag: "id", kind: "text", required: true, message: "Id" }]
 */
export function toOptionDescriptors(options: OptionSpecs): OptionDescriptor[] {
  return Object.entries(options).map(([flag, option]) => ({ ...option, flag }));
}

/** The value hint shown after a flag in the usage line and errors. */
function placeholder(option: OptionDescriptor): string {
  if (option.kind === OptionKind.Path) return CliLabel.PathPlaceholder;
  if (option.kind === OptionKind.List) return CliLabel.ListPlaceholder;
  return `<${option.flag}>`;
}

/** Builds the one-line usage: required flags bare, optional ones bracketed. */
function formatUsage(
  command: string,
  options: readonly OptionDescriptor[],
): string {
  const flags = options.map((option) => {
    const flag = `--${option.flag} ${placeholder(option)}`;
    return option.required ? flag : `[${flag}]`;
  });
  return [CliLabel.Usage, command, ...flags].join(" ");
}

/** Splits a comma-separated list, dropping empty entries. */
function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Converts a string value into what run receives for the option's kind. */
function toValue(
  option: OptionDescriptor,
  value: string | undefined,
  cwd: string,
): string | string[] | undefined {
  if (option.kind === OptionKind.List) return splitList(value);
  if (value === undefined) return undefined;
  return option.kind === OptionKind.Path ? resolve(cwd, value) : value;
}

/**
 * Parses argv against a tool's options.
 *
 * @param options - The tool's options keyed by flag.
 * @param argv - Flags and values, without the tool id.
 * @param cwd - Base directory for relative paths.
 * @param usage - Appended to a missing-flag error.
 * @returns The typed values: paths absolute, lists split on commas, defaults
 *   applied in declaration order (each sees the values before it).
 * @throws If a required flag is missing or an unknown flag is passed.
 *
 * @example
 * parseToolArgs(options, ["--resume", "Resume.md", "--tags", "a,b"], "/cv", usage);
 * // { resume: "/cv/Resume.md", tags: ["a", "b"] }
 */
export function parseToolArgs<TOptions extends OptionSpecs>(
  options: TOptions,
  argv: string[],
  cwd: string,
  usage: string,
): OptionValues<TOptions> {
  const descriptors = toOptionDescriptors(options);
  const { values: parsed } = parseArgs({
    args: argv,
    options: Object.fromEntries(
      descriptors.map(({ flag }) => [flag, STRING_FLAG]),
    ),
    strict: true,
  });

  const given: Record<string, string> = {};
  for (const [flag, value] of Object.entries(parsed)) {
    if (typeof value === "string" && value) given[flag] = value;
  }

  const values: Record<string, string | string[] | undefined> = {};
  for (const option of descriptors) {
    const value = given[option.flag] ?? option.default?.(given);
    if (!value && option.required) {
      throw new Error(
        `--${option.flag} ${placeholder(option)} ${CliLabel.IsRequired}\n${usage}`,
      );
    }
    if (value !== undefined) given[option.flag] = value;
    values[option.flag] = toValue(option, value, cwd);
  }
  // Built key by key from `options` with each kind's value, so it matches
  // OptionValues; TypeScript can't follow that through the loop.
  return values as OptionValues<TOptions>;
}

/**
 * Turns what a tool file declares into what the menu and direct command run.
 *
 * @param spec - The tool's id, menu text, options and typed run.
 * @returns The tool, with its command, usage line, option list and an argv
 *   `run` that parses with parseToolArgs before calling `spec.run`.
 *
 * @example
 * export const deleteTool = defineTool({
 *   id: "delete-rx-resume",
 *   options: { id: { kind: OptionKind.Text, required: true, message: "Id" } },
 *   run: async ({ id }, { env }) => { … },
 *   …
 * });
 */
export function defineTool<const TOptions extends OptionSpecs>(
  spec: ToolSpec<TOptions>,
): ToolDefinition {
  const command = `${CLI_COMMAND} ${spec.id}`;
  const options = toOptionDescriptors(spec.options);
  const usage = formatUsage(command, options);

  return {
    id: spec.id,
    title: spec.title,
    description: spec.description,
    platform: spec.platform,
    command,
    usage,
    options,
    preflight: spec.preflight,
    run: (argv, context) =>
      spec.run(parseToolArgs(spec.options, argv, context.cwd, usage), context),
  };
}
