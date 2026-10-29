/**
 * error.ts
 *
 * The base every error the tools own extends: a typed reason instead of free
 * text, so a caller can tell failures apart by `reason.code` and read their
 * details without parsing the message.
 */

/**
 * Words a caught value as one line, led by its `code` when it has one, as
 * Bun's network errors do (`ConnectionRefused`, `CERT_HAS_EXPIRED`, …).
 *
 * @param error - Anything caught.
 * @returns `code: message`, the message alone, or the value as a string.
 *
 * @example
 * describeCaught(Object.assign(new Error("Unable to connect."), {
 *   code: "ConnectionRefused",
 * }));
 * // "ConnectionRefused: Unable to connect."
 */
export function describeCaught(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  if ("code" in error && typeof error.code === "string") {
    return `${error.code}: ${error.message}`;
  }
  return error.message;
}

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
