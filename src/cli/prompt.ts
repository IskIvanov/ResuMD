/**
 * prompt.ts
 *
 * Asks for a tool's options and turns the answers into tool arguments:
 * required options first, then a checkbox of optional flags, then a prompt
 * for each one ticked. Each typed answer is checked as it's entered, so the
 * menu can't build tool arguments the tool would reject.
 */

import { extname, resolve } from "node:path";
import { firstIssue } from "../utils/schema.ts";
import {
  type Answers,
  type Choice,
  OptionKind,
  type OptionDescriptor,
  type PathLookup,
  type PathRule,
  type Prompter,
  type Validator,
} from "./types.ts";

/** Accepts any answer. */
const acceptAnyAnswer: Validator = () => true;

/** Rejects a blank answer. */
const rejectBlankAnswer: Validator = (answer) => {
  if (answer.trim()) return true;
  return "A value is required";
};

/**
 * Checks a typed path, in order: not empty, has an extension, the extension
 * is allowed, and (when the rule requires it) the file exists. Only the
 * first failure is reported.
 */
function pathValidator(rule: PathRule, pathLookup: PathLookup): Validator {
  const expected = `expected ${rule.extensions.join(" or ")}`;
  return (typedPath) => {
    const path = typedPath.trim();
    const extension = extname(path);

    if (!path) return "A path is required";
    if (!extension) return `Missing file extension — ${expected}`;
    if (!rule.extensions.some((allowed) => allowed === extension)) {
      return `Unsupported format "${extension}" — ${expected}`;
    }
    const absolutePath = resolve(pathLookup.workingDirectory, path);
    if (rule.mustExist && !pathLookup.exists(absolutePath)) {
      return `File not found: ${path}`;
    }
    return true;
  };
}

/** Checks a typed answer: a path by its rule, text by its schema, else not blank if required. */
function answerValidator(
  option: OptionDescriptor,
  pathLookup: PathLookup,
): Validator {
  switch (option.kind) {
    case OptionKind.Path:
      return pathValidator(option.path, pathLookup);
    case OptionKind.Text:
    case OptionKind.List: {
      const { schema } = option;
      if (schema) return (answer) => firstIssue(schema, answer) ?? true;
    }
  }
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
    name: `${flag} (default: ${defaultAnswer})`,
    value: option.flag,
  };
}

/**
 * Asks for one option's answer. A choice is picked from a select, which
 * can't produce an invalid value; every other kind is typed and validated,
 * hidden for a secret.
 */
async function askForAnswer(
  option: OptionDescriptor,
  prompter: Prompter,
  pathLookup: PathLookup,
): Promise<string> {
  if (option.kind === OptionKind.Choice) {
    return prompter.select({
      question: option.question,
      choices: option.choices.map(toChoiceEntry),
    });
  }
  if (option.kind !== OptionKind.Path && option.secret) {
    return prompter.password({
      question: option.question,
      validate: answerValidator(option, pathLookup),
    });
  }
  return prompter.input({
    question: option.question,
    validate: answerValidator(option, pathLookup),
  });
}

/**
 * Prompts for a tool's options and returns the matching tool arguments.
 *
 * @param options - The tool's options, each with its flag.
 * @param prompter - Where the prompts are shown.
 * @param pathLookup - Working directory and existence check for path options.
 * @returns Flags and answers in option order; unticked optional flags are
 *   left out, so the tool applies its own defaults. Answers are passed as
 *   typed: the tool resolves relative paths from the same working directory.
 *
 * @example
 * await promptOptions(deleteResumeTool.options, prompter, pathLookup);
 * // ["--id", "resume-1"]
 */
export async function promptOptions(
  options: readonly OptionDescriptor[],
  prompter: Prompter,
  pathLookup: PathLookup,
): Promise<string[]> {
  const answers: Record<string, string> = {};
  const recordAnswer = async (option: OptionDescriptor): Promise<void> => {
    const answer = await askForAnswer(option, prompter, pathLookup);
    answers[option.flag] = answer.trim();
  };

  const requiredOptions = options.filter((option) => option.required);
  for (const option of requiredOptions) {
    await recordAnswer(option);
  }

  const optionalOptions = options.filter((option) => !option.required);
  if (optionalOptions.length > 0) {
    const tickedFlags = await prompter.checkbox({
      question: "Set any optional flags?",
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
