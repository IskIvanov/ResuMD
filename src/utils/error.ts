/**
 * error.ts
 *
 * The base every error the tools own extends: a typed reason instead of free
 * text, so a caller can tell failures apart by `reason.code` and read their
 * details without parsing the message.
 */

/** What went wrong: a code naming the failure, plus what its message needs. */
export interface ErrorReason {
  readonly code: string;
}

/**
 * An error that carries a typed reason. A subclass declares its reasons as a
 * discriminated union on `code` and builds the message from the reason, so a
 * caller passes data, never text.
 *
 * @example
 * class CliError extends ReasonedError<CliErrorReason> {
 *   constructor(reason: CliErrorReason) {
 *     super(reason, describeCliError(reason));
 *   }
 * }
 */
export abstract class ReasonedError<TReason extends ErrorReason> extends Error {
  readonly reason: TReason;

  protected constructor(
    reason: TReason,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
    this.reason = reason;
  }
}
