/**
 * schema.ts
 *
 * Validation for values typed at the interactive prompts. Flag mode doesn't
 * use it; its paths are checked by the tools themselves.
 */

import { extname, resolve } from "path";
import { z } from "zod";
import {
  CliLabel,
  OptionDescriptor,
  OptionKind,
  type FileExtension,
  type PathContext,
  type PathRule,
  type Validator,
} from "./types.ts";
/**
 * Builds the schema for one path option. Checks, in order: not empty, has an
 * extension, the extension is allowed, and — when the rule requires it — the
 * file exists. Only the first failure is reported.
 *
 * @param rule - Allowed extensions and whether the file must already exist.
 * @param context - Base directory and an existence check, so tests need no files.
 * @returns A schema that parses the path as typed.
 *
 * @example
 * pathSchema({ extensions: [FileExtension.Markdown], mustExist: true }, context)
 *   .safeParse("Resume.cp");
 * // issue: 'Unsupported format ".cp" — expected .md'
 */
export function pathSchema(
  rule: PathRule,
  context: PathContext,
): z.ZodType<string> {
  const expected = `${CliLabel.Expected} ${rule.extensions.join(" or ")}`;
  const isAllowed = (extension: string): extension is FileExtension =>
    rule.extensions.some((allowed) => allowed === extension);

  return z.string().superRefine((raw, ctx) => {
    const fail = (message: string): void => {
      ctx.addIssue({ code: "custom", message });
    };
    const path = raw.trim();
    const extension = extname(path);

    if (!path) return fail(CliLabel.PathRequired);
    if (!extension) return fail(`${CliLabel.MissingExtension} — ${expected}`);
    if (!isAllowed(extension)) {
      return fail(`${CliLabel.UnsupportedFormat} "${extension}" — ${expected}`);
    }
    if (rule.mustExist && !context.exists(resolve(context.cwd, path))) {
      return fail(`${CliLabel.FileNotFound}: ${path}`);
    }
  });
}

export function answerSchema(
  option: OptionDescriptor,
  pathContext: PathContext,
): z.ZodType<string> {
  switch (option.kind) {
    case OptionKind.Path:
      return pathSchema(option.path, pathContext);
    case OptionKind.Text:
    case OptionKind.List:
      return option.schema ?? z.string();
    default:
      return z.string();
  }
}

/**
 * Turns a schema into a prompt validator that reports the first issue.
 *
 * @param schema - Any schema; it is given the raw string.
 * @returns `true` when the value parses, otherwise the first issue's message.
 *
 * @example
 * toValidator(pathSchema(rule, context))("nope.md"); // "File not found: nope.md"
 */
export function toValidator(schema: z.ZodType): Validator {
  return (value) => {
    const result = schema.safeParse(value);
    return result.success ? true : result.error.issues[0].message;
  };
}
