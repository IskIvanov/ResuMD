/**
 * run.ts
 *
 * Reads Resume.md, parses it via parser.ts, merges text-only changes into the
 * site CV via merger.ts, and writes the updated file. The merged data is then
 * patched into the RxResume JSON via render-json.ts. When the JSON does not
 * exist yet it is seeded from the template.
 *
 * Metadata-only fields in the CV (href, datetime, icon, credential IDs, etc.)
 * are never touched. On first run, the CV is reformatted by yaml.dump() —
 * this is intentional since the file becomes machine-maintained.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { relative } from "path";
import yaml from "js-yaml";
import type { CvData, SyncPaths } from "./types.ts";
import { parseResume } from "./parser.ts";
import { merge } from "./merger.ts";
import { patchResumeJson } from "./render-json.ts";

// ─── Frontmatter helpers ──────────────────────────────────────────────────────

/**
 * Splits a file with YAML frontmatter into its data and body components.
 * Throws if frontmatter delimiters are not found.
 */
function parseFrontmatter(
  raw: string,
  path: string,
): { data: CvData; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`No YAML frontmatter found in ${path}`);
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

/**
 * Syncs Resume.md into the site CV, then patches the RxResume JSON.
 *
 * @param paths - Absolute input and output paths.
 * @param cwd - Directory the printed paths are shown relative to.
 * @throws If a file can't be read, the CV has no frontmatter, or Resume.md
 *   fails validation.
 *
 * @example
 * await runSync({ cv, resume, json, template }, process.cwd());
 * // ✓ src/content/cv/en.md synced from resume/Resume.md
 * // ✓ resume/RxResume/Resume.json patched from src/content/cv/en.md
 */
export async function runSync(paths: SyncPaths, cwd: string): Promise<void> {
  const display = (path: string): string => relative(cwd, path);

  const resumeRaw = readFileSync(paths.resume, "utf-8");
  const cvRaw = readFileSync(paths.cv, "utf-8");

  const { data: cvData } = parseFrontmatter(cvRaw, paths.cv);
  const parsedResume = parseResume(resumeRaw);
  const summary = merge(cvData, parsedResume);

  writeFileSync(paths.cv, serializeCv(cvData, summary), "utf-8");
  console.log(`✓ ${display(paths.cv)} synced from ${display(paths.resume)}`);

  const jsonSource = existsSync(paths.json) ? paths.json : paths.template;
  const resumeJson = JSON.parse(readFileSync(jsonSource, "utf-8"));
  const patchedJson = patchResumeJson(cvData, resumeJson);
  writeFileSync(
    paths.json,
    JSON.stringify(patchedJson, null, 2) + "\n",
    "utf-8",
  );
  console.log(
    `✓ ${display(paths.json)} patched from ${display(paths.cv)}` +
      (jsonSource === paths.template ? " (seeded from template)" : ""),
  );
}
