/**
 * cli.ts
 *
 * Pure argument handling for the sync-resume CLI. Turns argv into absolute
 * file paths so index.ts stays a thin I/O entry point.
 */

import { resolve } from "path";
import { parseArgs } from "util";

/** Command-line option names accepted by sync-resume. */
export const SyncOption = {
  Cv: "cv",
  Resume: "resume",
  Json: "json",
  Template: "template",
} as const;

/** Default locations, relative to the resume-tools package root. */
const DefaultPath = {
  Resume: "resume/Resume.md",
  Json: "resume/RxResume/Resume.json",
  Template: "resume/RxResume/Resume.template.json",
} as const;

export const USAGE =
  "Usage: sync-resume --cv <path> [--resume <path>] [--json <path>] [--template <path>]";

/** Absolute paths the sync run reads from and writes to. */
export interface SyncPaths {
  /** Site CV markdown with YAML frontmatter (e.g. src/content/cv/en.md). */
  cv: string;
  /** Source-of-truth Resume.md. */
  resume: string;
  /** RxResume JSON to patch; created from `template` when it does not exist. */
  json: string;
  /** RxResume template used to seed `json`. */
  template: string;
}

/** Directories that relative paths are resolved against. */
export interface PathContext {
  /** Working directory — base for any path passed on the command line. */
  cwd: string;
  /** resume-tools package root — base for default paths. */
  packageRoot: string;
}

/**
 * Parses sync-resume CLI arguments into absolute paths.
 *
 * @param argv - Arguments after the script name (`process.argv.slice(2)`).
 * @param context - Directories used to resolve given and default paths.
 * @returns The resolved input and output paths.
 * @throws If `--cv` is missing or an unknown option is passed.
 *
 * @example
 * resolveSyncPaths(['--cv', 'src/content/cv/en.md'], {
 *   cwd: '/portfolio',
 *   packageRoot: '/portfolio/packages/resume-tools',
 * })
 * // { cv: '/portfolio/src/content/cv/en.md',
 * //   resume: '/portfolio/packages/resume-tools/resume/Resume.md', ... }
 */
export function resolveSyncPaths(
  argv: string[],
  context: PathContext,
): SyncPaths {
  const { values } = parseArgs({
    args: argv,
    options: {
      [SyncOption.Cv]: { type: "string" },
      [SyncOption.Resume]: { type: "string" },
      [SyncOption.Json]: { type: "string" },
      [SyncOption.Template]: { type: "string" },
    },
    strict: true,
  });

  const cv = values[SyncOption.Cv];
  if (!cv) throw new Error(`--${SyncOption.Cv} <path> is required\n${USAGE}`);

  const fromCwd = (path: string): string => resolve(context.cwd, path);
  const fromPackage = (path: string): string =>
    resolve(context.packageRoot, path);

  const resume = values[SyncOption.Resume];
  const json = values[SyncOption.Json];
  const template = values[SyncOption.Template];

  return {
    cv: fromCwd(cv),
    resume: resume ? fromCwd(resume) : fromPackage(DefaultPath.Resume),
    json: json ? fromCwd(json) : fromPackage(DefaultPath.Json),
    template: template ? fromCwd(template) : fromPackage(DefaultPath.Template),
  };
}
