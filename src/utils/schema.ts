/**
 * schema.ts
 *
 * Generic Zod helpers: shared field rules, and parsing that reports every
 * failure with its path.
 */

import { z } from "zod";

/** What can be wrong with a field: missing, repeated or malformed. */
export const FieldProblem = {
  Required: "required",
  Empty: "needs at least one entry",
  Duplicate: "has duplicate entries",
  InvalidEmail: "invalid email format",
} as const;

/** A string that must be present and non-empty. */
export const requiredText = z
  .string({
    error: (issue) =>
      issue.input === undefined ? FieldProblem.Required : undefined,
  })
  .min(1, FieldProblem.Required);

/** A Zod issue path as code writes it: `jobs[2].role`. */
function formatIssuePath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((formatted, segment) => {
    if (typeof segment === "number") return `${formatted}[${segment}]`;
    const key = String(segment);
    return formatted ? `${formatted}.${key}` : key;
  }, "");
}

/**
 * Checks a value against a schema and words its first failure.
 *
 * @param schema - Any schema.
 * @param value - The value to check.
 * @returns The first issue's message, or undefined when the value parses.
 *
 * @example
 * firstIssue(z.uuid({ message: "not a UUID" }), "letter-1"); // "not a UUID"
 */
export function firstIssue(
  schema: z.ZodType,
  value: unknown,
): string | undefined {
  const result = schema.safeParse(value);
  if (result.success) return undefined;
  return result.error.issues[0]?.message;
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
 * parseOrThrow(ResumeMdSchema, { ...resume, jobs: [] }, "Invalid Resume.md:");
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
