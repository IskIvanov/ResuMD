/**
 * prompt-options.ts
 *
 * Asks for a tool's options and turns the answers into argv: required options
 * first, then a checkbox of optional flags, then a prompt for each one ticked.
 */

import { answerSchema, toValidator } from "./schema.ts";
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

/** Rejects a blank answer. */
const rejectBlankAnswer: Validator = (answer) => {
  if (answer.trim()) return true;
  return CliLabel.ValueRequired;
};

/** Accepts any answer. */
const acceptAnyAnswer: Validator = () => true;

/** Checks a typed answer: its schema, else not blank if required. */
function answerValidator(
  option: OptionDescriptor,
  pathContext: PathContext,
): Validator {
  const schema = answerSchema(option, pathContext);
  if (schema) return toValidator(schema);
  if (option.required) return rejectBlankAnswer;
  return acceptAnyAnswer;
}

/** A select entry that shows one of a choice option's values as itself. */
function toChoiceEntry(choice: string): Choice<string> {
  return { name: choice, value: choice };
}

/** The checkbox entry for an optional flag, showing its default if it has one. */
function toOptionalFlagEntry(
  option: OptionDescriptor,
  answers: Answers,
): Choice<string> {
  const flag = `--${option.flag}`;
  const defaultAnswer = option.default?.(answers);
  if (!defaultAnswer) return { name: flag, value: option.flag };
  return {
    name: `${flag} (${CliLabel.Default}: ${defaultAnswer})`,
    value: option.flag,
  };
}

/**
 * Asks for one option's answer. A choice is picked from a select, which
 * can't produce an invalid value; every other kind is typed and validated.
 */
async function askForAnswer(
  option: OptionDescriptor,
  prompter: Prompter,
  pathContext: PathContext,
): Promise<string> {
  if (option.kind === OptionKind.Choice) {
    return prompter.select({
      message: option.message,
      choices: option.choices.map(toChoiceEntry),
    });
  }
  return prompter.input({
    message: option.message,
    validate: answerValidator(option, pathContext),
  });
}

/**
 * Prompts for a tool's options and returns the matching argv.
 *
 * @param options - The tool's options, each with its flag.
 * @param prompter - Where the prompts are shown.
 * @param pathContext - Base directory and existence check for path options.
 * @returns Flags and answers in option order; unticked optional flags are
 *   left out, so the tool applies its own defaults. Answers are passed as
 *   typed: the tool resolves relative paths from the same working directory.
 *
 * @example
 * await promptOptions(encodeTool.options, prompter, pathContext);
 * // ["--cv", "cv.md"]
 */
export async function promptOptions(
  options: readonly OptionDescriptor[],
  prompter: Prompter,
  pathContext: PathContext,
): Promise<string[]> {
  const answers: Record<string, string> = {};
  const recordAnswer = async (option: OptionDescriptor): Promise<void> => {
    const answer = await askForAnswer(option, prompter, pathContext);
    answers[option.flag] = answer.trim();
  };

  const requiredOptions = options.filter((option) => option.required);
  for (const option of requiredOptions) {
    await recordAnswer(option);
  }

  const optionalOptions = options.filter((option) => !option.required);
  if (optionalOptions.length > 0) {
    const tickedFlags = await prompter.checkbox({
      message: CliLabel.OptionalFlags,
      choices: optionalOptions.map((option) =>
        toOptionalFlagEntry(option, answers),
      ),
    });
    const tickedOptions = optionalOptions.filter((option) =>
      tickedFlags.includes(option.flag),
    );
    for (const option of tickedOptions) {
      await recordAnswer(option);
    }
  }

  return options
    .filter((option) => answers[option.flag])
    .flatMap((option) => [`--${option.flag}`, answers[option.flag]]);
}
