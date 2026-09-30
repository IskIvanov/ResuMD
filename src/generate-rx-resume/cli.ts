/**
 * cli.ts
 *
 * Pure argument handling for the generate-rx-resume CLI. Turns argv into the
 * resume path and the new resume's name, slug and tags.
 */

import { resolve } from "path";
import { parseArgs } from "util";
import type { GenerateOptions } from "./types.ts";

/** Command-line option names accepted by generate-rx-resume. */
export const GenerateOption = {
  Resume: "resume",
  Name: "name",
  Slug: "slug",
  Tags: "tags",
} as const;

export const USAGE =
  "Usage: generate-rx-resume --resume <path> --name <name> [--slug <slug>] [--tags <a,b>]";

/**
 * Converts a name into a URL slug: lowercase ASCII words joined by dashes.
 *
 * @param name - Any display name.
 * @returns The slug, or an empty string if the name has no letters or digits.
 *
 * @example
 * slugify("Zoë Doe — Frontend"); // "zoe-doe-frontend"
 */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Splits a comma-separated list, dropping empty entries. */
function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Parses generate-rx-resume CLI arguments.
 *
 * @param argv - Arguments after the script name (`process.argv.slice(2)`).
 * @param cwd - Base directory for a relative `--resume` path.
 * @returns The resolved options; the slug defaults to `slugify(name)`.
 * @throws If `--resume` or `--name` is missing, no slug can be derived, or an
 *   unknown option is passed.
 *
 * @example
 * resolveGenerateOptions(["--resume", "Resume.md", "--name", "Jane Doe"], "/cv");
 * // { resume: "/cv/Resume.md", name: "Jane Doe", slug: "jane-doe", tags: [] }
 */
export function resolveGenerateOptions(
  argv: string[],
  cwd: string,
): GenerateOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      [GenerateOption.Resume]: { type: "string" },
      [GenerateOption.Name]: { type: "string" },
      [GenerateOption.Slug]: { type: "string" },
      [GenerateOption.Tags]: { type: "string" },
    },
    strict: true,
  });

  const resume = values[GenerateOption.Resume];
  if (!resume)
    throw new Error(`--${GenerateOption.Resume} <path> is required\n${USAGE}`);
  const name = values[GenerateOption.Name];
  if (!name)
    throw new Error(`--${GenerateOption.Name} <name> is required\n${USAGE}`);

  const slug = values[GenerateOption.Slug] || slugify(name);
  if (!slug) {
    throw new Error(
      `Cannot derive a slug from "${name}"; pass --${GenerateOption.Slug}\n${USAGE}`,
    );
  }

  return {
    resume: resolve(cwd, resume),
    name,
    slug,
    tags: splitList(values[GenerateOption.Tags]),
  };
}
