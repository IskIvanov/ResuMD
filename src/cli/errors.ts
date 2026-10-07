/**
 * errors.ts
 *
 * The one error the CLI throws. Callers pass a CliErrorReason, never a
 * message, so every CLI failure is told apart by its code and worded here, and
 * run-cli.ts can recognise a cancelled prompt without importing a prompt
 * library.
 */

import { ReasonedError } from "../utils/error.ts";
import { CliErrorCode, CliLabel, type CliErrorReason } from "./types.ts";

/**
 * Words a reason as the message the user sees. The switch has no default, so
 * a new code that isn't worded here fails to compile.
 */
function describeCliError(reason: CliErrorReason): string {
  switch (reason.code) {
    case CliErrorCode.MissingOption:
      return `--${reason.flag} ${reason.placeholder} ${CliLabel.IsRequired}\n${reason.usage}`;
    case CliErrorCode.InvalidChoice:
      return `--${reason.flag} ${CliLabel.MustBeOneOf} ${reason.choices.join(", ")}`;
    case CliErrorCode.UnderivableDefault:
      return `${CliLabel.CannotDerive} --${reason.flag} ${CliLabel.From} "${reason.source}"; ${CliLabel.Pass} --${reason.flag}`;
    case CliErrorCode.PromptCancelled:
      return CliLabel.PromptCancelled;
  }
}

/**
 * A CLI failure, typed by its reason.
 *
 * @example
 * throw new CliError({ code: CliErrorCode.InvalidChoice, flag, choices });
 * // --template must be one of azurill, bronzor, …
 */
export class CliError<
  TReason extends CliErrorReason = CliErrorReason,
> extends ReasonedError<TReason> {
  constructor(reason: TReason) {
    super(reason, describeCliError(reason));
  }
}

/**
 * Tells whether an error is a CliError with the given code, narrowing its
 * reason to that code's shape.
 *
 * @param error - Anything caught.
 * @param code - The code to match.
 * @returns True for a CliError whose reason has `code`.
 *
 * @example
 * if (isCliError(error, CliErrorCode.PromptCancelled)) return ExitCode.Cancelled;
 */
export function isCliError<TCode extends CliErrorCode>(
  error: unknown,
  code: TCode,
): error is CliError<Extract<CliErrorReason, { code: TCode }>> {
  return error instanceof CliError && error.reason.code === code;
}
