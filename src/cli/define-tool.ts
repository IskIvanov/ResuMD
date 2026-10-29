/**
 * define-tool.ts
 *
 * Turns a tool's specs into everything both ways of running it need: the
 * menu's option list, the usage line and one argument parser. A tool declares
 * each option once and its run receives typed values, so the menu and the
 * direct command can't drift apart.
 *
 * Parsing the tool arguments takes three steps, each with its own data (the
 * terms are defined in types.ts):
 * 1. answers: the flags given in the tool arguments, then each missing one's
 *    default.
 * 2. checks: every required option has an answer, every choice a valid one.
 * 3. values: each answer converted for its kind, as run receives it.
 */

import { resolve } from "path";
import { parseArgs } from "util";
import { fillDefaults, pickNonEmptyStrings } from "../utils/record.ts";
import { firstIssue } from "../utils/schema.ts";
import { splitList } from "../utils/string.ts";
import {
  type AnyOptionValue,
  type Answers,
  OptionKind,
  type OptionDescriptor,
  type OptionSpecs,
  type OptionValues,
  type ToolDefinition,
  type ToolSpec,
} from "./types.ts";

/** The direct command; a tool runs as `bun run cli <tool id> [flags]`. */
const CLI_COMMAND = "bun run cli";

/** Every flag takes a string value; kinds are converted after parsing. */
const STRING_FLAG = { type: "string" } as const;

/**
 * Lists a tool's options with their flags, in declaration order.
 *
 * @param specs - The tool's specs, keyed by flag.
 * @returns One option per spec, with its flag.
 *
 * @example
 * toOptionDescriptors({ id: { kind: OptionKind.Text, required: true, question: "Id" } });
 * // [{ flag: "id", kind: "text", required: true, question: "Id" }]
 */
function toOptionDescriptors(specs: OptionSpecs): OptionDescriptor[] {
  return Object.entries(specs).map(([flag, spec]) => ({ ...spec, flag }));
}

/**
 * The value hint shown after a flag in the usage line and errors. A choice
 * shows `<flag>`, like text; its values are listed when one is rejected.
 */
function valuePlaceholder(option: OptionDescriptor): string {
  if (option.kind === OptionKind.Path) return "<path>";
  if (option.kind === OptionKind.List) return "<a,b>";
  return `<${option.flag}>`;
}

/** Builds the one-line usage: required flags bare, optional ones bracketed. */
function formatUsage(
  command: string,
  options: readonly OptionDescriptor[],
): string {
  const flags = options.map((option) => {
    const flag = `--${option.flag} ${valuePlaceholder(option)}`;
    if (option.required) return flag;
    return `[${flag}]`;
  });
  return ["Usage:", command, ...flags].join(" ");
}

/** Step 1: the answers given in the tool arguments, then each missing option's default. */
function collectAnswers(
  options: readonly OptionDescriptor[],
  toolArguments: readonly string[],
): Answers {
  const { values: givenAnswers } = parseArgs({
    args: [...toolArguments],
    options: Object.fromEntries(options.map(({ flag }) => [flag, STRING_FLAG])),
    strict: true,
  });
  return fillDefaults(
    pickNonEmptyStrings(givenAnswers),
    options.map((option) => [option.flag, option.default]),
  );
}

/**
 * Step 2: throws when an answer breaks its option's rules: a
 * required option without one, a choice outside its choices, or text its
 * schema refuses. Paths are checked only at the prompt; here the tool's read
 * reports a missing file.
 */
function assertValidAnswer(
  option: OptionDescriptor,
  answer: string | undefined,
  usage: string,
): void {
  const flag = `--${option.flag}`;
  if (!answer && option.required) {
    throw new Error(
      `${flag} ${valuePlaceholder(option)} is required\n${usage}`,
    );
  }
  if (answer === undefined) return;
  switch (option.kind) {
    case OptionKind.Choice:
      if (option.choices.includes(answer)) return;
      throw new Error(`${flag} must be one of ${option.choices.join(", ")}`);
    case OptionKind.Text:
    case OptionKind.List: {
      if (!option.schema) return;
      const issue = firstIssue(option.schema, answer);
      if (issue === undefined) return;
      throw new Error(`${flag}: ${issue}`);
    }
  }
}

/** Step 3: converts an answer into the value run receives for its kind. */
function toOptionValue(
  option: OptionDescriptor,
  answer: string | undefined,
  workingDirectory: string,
): AnyOptionValue {
  if (option.kind === OptionKind.List) return splitList(answer);
  if (answer === undefined) return undefined;
  if (option.kind === OptionKind.Path) return resolve(workingDirectory, answer);
  return answer;
}

/**
 * Parses the tool arguments against a tool's specs.
 *
 * @param specs - The tool's specs, keyed by flag.
 * @param toolArguments - Flags and values, without the tool id.
 * @param workingDirectory - Where relative paths start.
 * @param usage - Printed under a missing-option error.
 * @returns The typed values: paths absolute, lists split on commas, defaults
 *   applied in declaration order (each sees the answers before it).
 * @throws If a required option has no answer, a choice is given a
 *   value outside its choices or text breaks its schema, and parseArgs' error
 *   for an unknown flag.
 */
function parseToolArguments<TOptions extends OptionSpecs>(
  specs: TOptions,
  toolArguments: readonly string[],
  workingDirectory: string,
  usage: string,
): OptionValues<TOptions> {
  const options = toOptionDescriptors(specs);
  const answers = collectAnswers(options, toolArguments);
  for (const option of options) {
    assertValidAnswer(option, answers[option.flag], usage);
  }
  const values = Object.fromEntries(
    options.map((option) => [
      option.flag,
      toOptionValue(option, answers[option.flag], workingDirectory),
    ]),
  );
  // Built key by key from `specs` with each kind's value, so it matches
  // OptionValues; TypeScript can't follow that through Object.fromEntries.
  return values as OptionValues<TOptions>;
}

/**
 * Turns what a tool file declares into what the menu and direct command run.
 *
 * @param spec - The tool's id, menu text, specs and typed run.
 * @returns The tool, with its command, usage line, option list, a typed
 *   `parse`, and a `run` that parses the tool arguments before calling
 *   `spec.run`.
 *
 * @example
 * export const deleteResumeTool = defineTool({
 *   id: "delete-resume",
 *   options: { id: { kind: OptionKind.Text, required: true, question: "Id" } },
 *   run: async ({ id }, dependencies) => { … },
 *   …
 * });
 * deleteResumeTool.parse(["--id", "r1"], workingDirectory); // { id: "r1" }
 */
export function defineTool<const TOptions extends OptionSpecs>(
  spec: ToolSpec<TOptions>,
): ToolDefinition<OptionValues<TOptions>> {
  const command = `${CLI_COMMAND} ${spec.id}`;
  const options = toOptionDescriptors(spec.options);
  const usage = formatUsage(command, options);
  const parse = (
    toolArguments: readonly string[],
    workingDirectory: string,
  ): OptionValues<TOptions> =>
    parseToolArguments(spec.options, toolArguments, workingDirectory, usage);

  return {
    id: spec.id,
    title: spec.title,
    description: spec.description,
    command,
    usage,
    options,
    preflight: spec.preflight,
    parse,
    run: async (toolArguments, dependencies) =>
      spec.run(
        parse(toolArguments, dependencies.workingDirectory),
        dependencies,
      ),
  };
}
