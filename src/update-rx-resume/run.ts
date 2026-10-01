/**
 * run.ts
 *
 * Parses Resume.md and writes it into an existing Reactive Resume resume via
 * the API: fetch → apply the parsed data → update. The layout, picture,
 * template and every section Resume.md does not feed are kept.
 *
 * Needs RXRESUME_API_KEY, RXRESUME_API_URL and RXRESUME_APP_URL in the
 * environment (see .env.example).
 */

import { readFileSync } from "fs";
import { randomUUID } from "crypto";
import { parseResume } from "../sync-resume/parser.ts";
import { applyResumeData } from "../rx-resume/apply-data.ts";
import { createRxResumeClient } from "../rx-resume/client.ts";
import { resolveApiConfig, resolveBuilderUrl } from "../rx-resume/config.ts";
import { patchResumeData } from "../rx-resume/patch.ts";
import { toResumeData } from "../rx-resume/resume-data.ts";
import type { Env } from "../rx-resume/types.ts";
import type { UpdateOptions } from "./types.ts";

/**
 * Updates a Reactive Resume resume from Resume.md and prints its builder link.
 *
 * @param options - The resume's id and the path to Resume.md.
 * @param env - Environment holding the Reactive Resume API settings.
 * @throws If an API variable is missing, Resume.md fails validation, or the
 *   API rejects a request (e.g. an unknown id or a locked resume).
 *
 * @example
 * await runUpdate({ id, resume }, process.env);
 * // ✓ Updated "Jane Doe" (slug jane-doe, id …)
 * //   builder: https://rxresu.me/builder/…
 */
export async function runUpdate(
  options: UpdateOptions,
  env: Env,
): Promise<void> {
  const config = resolveApiConfig(env);
  const data = toResumeData(parseResume(readFileSync(options.resume, "utf-8")));

  const client = createRxResumeClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    fetch: globalThis.fetch,
  });
  const resume = await patchResumeData(client, options.id, (current) =>
    applyResumeData(current, data, randomUUID),
  );

  console.log(
    `✓ Updated "${resume.name}" (slug ${resume.slug}, id ${resume.id})`,
  );
  console.log(`  builder: ${resolveBuilderUrl(config.appUrl, resume.id)}`);
}
