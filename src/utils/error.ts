/**
 * error.ts
 *
 * The base every error the tools own extends: a typed reason instead of free
 * text, so a caller can tell failures apart by `reason.code` and read their
 * details without parsing the message.
 */

import type { ErrorReason } from "./types.ts";

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

/**
 * Runs a check and words its failure, e.g. for a tool's preflight.
 *
 * @param attempt - The check, which throws when it fails.
 * @returns The thrown message, or undefined when the check passes.
 *
 * @example
 * failureOf(() => resolveApiConfig({})); // "Missing RXRESUME_API_KEY, …"
 */
export function failureOf(attempt: () => unknown): string | undefined {
  try {
    attempt();
    return undefined;
  } catch (error) {
    if (error instanceof Error) return error.message;
    return String(error);
  }
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
