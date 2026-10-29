/**
 * error.ts
 *
 * Generic helpers for errors the tools catch.
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
