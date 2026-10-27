/**
 * schema.ts
 *
 * Generic Zod helpers: shared field rules, and parsing that reports every
 * failure with its path.
 */

import { z } from "zod";

/** Messages reported for a value that is missing, repeated or malformed. */
export const ValidationMessage = {
  Required: "required",
  Empty: "needs at least one entry",
  Duplicate: "has duplicate entries",
  InvalidEmail: "invalid email format",
} as const;

/** A string that must be present and non-empty. */
export const requiredText = z
  .string({
    error: (issue) =>
      issue.input === undefined ? ValidationMessage.Required : undefined,
  })
  .min(1, ValidationMessage.Required);

/**
 * Formats a Zod issue path the way it is written in code.
 *
 * @param path - Object keys and array indices, outermost first.
 * @returns The path with keys joined by dots and indices in brackets.
 *
 * @example
 * formatIssuePath(["jobs", 2, "role"]); // "jobs[2].role"
 */
export function formatIssuePath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((formatted, segment) => {
    if (typeof segment === "number") return `${formatted}[${segment}]`;
    const key = String(segment);
    return formatted ? `${formatted}.${key}` : key;
  }, "");
}

/**
 * Parses a value with a schema, reporting every failure with its path.
 *
 * @param schema - The schema to parse with.
 * @param value - The value to check.
 * @param heading - The first line of the error, e.g. "Invalid Resume.md:".
 * @returns The parsed value.
 * @throws If the value doesn't match; the error lists each failure under the
 *   heading, e.g. `  jobs[2].role: required`.
 *
 * @example
 * parseOrThrow(ParsedResumeSchema, { ...resume, jobs: [] }, "Invalid Resume.md:");
 * // Error: Invalid Resume.md:
 * //   jobs: needs at least one entry
 */
export function parseOrThrow<TOutput>(
  schema: z.ZodType<TOutput>,
  value: unknown,
  heading: string,
): TOutput {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  const failures = result.error.issues.map(
    (issue) => `  ${formatIssuePath(issue.path)}: ${issue.message}`,
  );
  throw new Error([heading, ...failures].join("\n"));
}
