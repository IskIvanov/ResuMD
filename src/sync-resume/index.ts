/**
 * sync-resume/index.ts
 *
 * Reads Resume.md, parses it via parser.ts, merges text-only changes into the
 * site CV (--cv) via merger.ts, and writes the updated file. The merged data
 * is then patched into the RxResume JSON (--json) via render-json.ts. When the
 * JSON does not exist yet it is seeded from the template (--template).
 *
 * Metadata-only fields in the CV (href, datetime, icon, credential IDs, etc.)
 * are never touched. On first run, the CV is reformatted by yaml.dump() —
 * this is intentional since the file becomes machine-maintained.
 *
 * Run: bun src/sync-resume/index.ts --cv <path> --resume <path>
 *        [--json <path>] [--template <path>]
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve, dirname, relative } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";
import type { CvData } from "./types.ts";
import { parseResume } from "./parser.ts";
import { merge } from "./merger.ts";
import { patchResumeJson } from "./render-json.ts";
import { resolveSyncPaths, type SyncPaths } from "./cli.ts";

// ─── Paths ────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, "../..");

/** Parses argv, printing the usage error without a stack trace on failure. */
function readPaths(): SyncPaths {
  try {
    return resolveSyncPaths(process.argv.slice(2), {
      cwd: process.cwd(),
      packageRoot: PACKAGE_ROOT,
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

const paths = readPaths();
const display = (path: string): string => relative(process.cwd(), path);

// ─── Frontmatter helpers ──────────────────────────────────────────────────────

/**
 * Splits a file with YAML frontmatter into its data and body components.
 * Throws if frontmatter delimiters are not found.
 */
function parseFrontmatter(raw: string): { data: CvData; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`No YAML frontmatter found in ${paths.cv}`);
  return {
    data: yaml.load(match[1]) as CvData,
    body: match[2].trim(),
  };
}

/**
 * Serializes CvData and a summary body back into a frontmatter file string.
 * Note: yaml.dump() reformats the YAML on first run — this is intentional.
 */
function serializeCv(data: CvData, body: string): string {
  const frontmatter = yaml.dump(data, {
    lineWidth: -1,
    quotingType: "'",
    noRefs: true,
  });
  return `---\n${frontmatter}---\n\n${body}\n`;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

const resumeRaw = readFileSync(paths.resume, "utf-8");
const cvRaw = readFileSync(paths.cv, "utf-8");

const { data: cvData } = parseFrontmatter(cvRaw);
const parsedResume = parseResume(resumeRaw);
const summary = merge(cvData, parsedResume);

writeFileSync(paths.cv, serializeCv(cvData, summary), "utf-8");
console.log(`✓ ${display(paths.cv)} synced from ${display(paths.resume)}`);

const jsonSource = existsSync(paths.json) ? paths.json : paths.template;
const resumeJson = JSON.parse(readFileSync(jsonSource, "utf-8"));
const patchedJson = patchResumeJson(cvData, resumeJson);
writeFileSync(paths.json, JSON.stringify(patchedJson, null, 2) + "\n", "utf-8");
console.log(
  `✓ ${display(paths.json)} patched from ${display(paths.cv)}` +
    (jsonSource === paths.template ? " (seeded from template)" : ""),
);
