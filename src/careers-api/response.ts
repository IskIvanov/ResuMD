/**
 * response.ts
 *
 * Reads and prints the careers API's raw response. Every call prints the
 * whole response, not only what the schema knows, because the docs show only
 * the reply to a test call.
 */

import type { ApiResponse } from "./types.ts";

/** Text printed around a response. */
export const ResponseLabel = {
  Heading: "Response:",
  EmptyBody: "(empty body)",
} as const;

const JSON_INDENT = 2;

/**
 * Parses JSON, or returns undefined when the text isn't JSON.
 *
 * @param text - A response body.
 * @returns The parsed value, or undefined.
 *
 * @example
 * parseJson('{"ok":true}'); // { ok: true }
 * parseJson("Bad gateway"); // undefined
 */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** The body pretty-printed when it is JSON, otherwise exactly as received. */
function formatBody(body: string): string {
  if (!body.trim()) return ResponseLabel.EmptyBody;
  const parsed = parseJson(body);
  return parsed === undefined
    ? body
    : JSON.stringify(parsed, null, JSON_INDENT);
}

/**
 * Formats a response for the terminal: the status line, then the full body.
 *
 * @param response - The status, status text and raw body.
 * @returns The status line, then the body: pretty-printed JSON, the text as
 *   received, or a marker when the body is empty.
 *
 * @example
 * formatApiResponse({ status: 200, statusText: "OK", body: '{"ok":true}' });
 * // 'Response: 200 OK\n{\n  "ok": true\n}'
 */
export function formatApiResponse(response: ApiResponse): string {
  const statusLine = [
    ResponseLabel.Heading,
    response.status,
    response.statusText,
  ]
    .filter((part) => part !== "")
    .join(" ");
  return `${statusLine}\n${formatBody(response.body)}`;
}
