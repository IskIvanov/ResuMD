/**
 * prompt-options.ts
 *
 * Asks for a tool's options and turns the answers into argv: required options
 * first, then a checkbox of optional flags, then a prompt for each one ticked.
 */

import { pathSchema, toValidator } from "./schema.ts";
import {
  CliLabel,
  OptionKind,
  type Answers,
  type Choice,
  type OptionDescriptor,
  type PathContext,
  type Prompter,
  type Validator,
} from "./types.ts";

/** Rejects an empty value. */
const requireValue: Validator = (value) =>
  value.trim() ? true : CliLabel.ValueRequired;

/** Picks the validator for an option: the path schema, or non-empty text. */
function validatorFor(
  option: OptionDescriptor,
  context: PathContext,
): Validator | undefined {
  if (option.kind === OptionKind.Path) {
    return toValidator(pathSchema(option.path, context));
  }
  return option.required ? requireValue : undefined;
}

/** Builds the checkbox entry for an optional flag, with its default shown. */
function toOptionalChoice(
  option: OptionDescriptor,
  answers: Answers,
): Choice<string> {
  const hint = option.default?.(answers);
  const name = hint
    ? `--${option.flag} (${CliLabel.Default}: ${hint})`
    : `--${option.flag}`;
  return { name, value: option.flag };
}

/**
 * Prompts for a tool's options and returns the matching argv.
 *
 * @param options - The tool's option descriptors.
 * @param prompter - Where the prompts are shown.
 * @param context - Base directory and existence check for path options.
 * @returns Flags and values in option order; unticked optional flags are left
 *   out, so the tool applies its own defaults. Values are passed as typed: the
 *   tool resolves relative paths from the same working directory.
 *
 * @example
 * await promptOptions(syncTool.options, prompter, context);
 * // ["--cv", "cv.md", "--resume", "resume/Resume.md"]
 */
export async function promptOptions(
  options: readonly OptionDescriptor[],
  prompter: Prompter,
  context: PathContext,
): Promise<string[]> {
  const answers: Record<string, string> = {};
  const ask = async (option: OptionDescriptor): Promise<void> => {
    const value = await prompter.input({
      message: option.message,
      validate: validatorFor(option, context),
    });
    answers[option.flag] = value.trim();
  };

  for (const option of options.filter((option) => option.required)) {
    await ask(option);
  }

  const optional = options.filter((option) => !option.required);
  if (optional.length > 0) {
    const ticked = await prompter.checkbox({
      message: CliLabel.OptionalFlags,
      choices: optional.map((option) => toOptionalChoice(option, answers)),
    });
    for (const option of optional.filter((o) => ticked.includes(o.flag))) {
      await ask(option);
    }
  }

  return options
    .filter((option) => answers[option.flag])
    .flatMap((option) => [`--${option.flag}`, answers[option.flag]]);
}
