/**
 * run.ts
 *
 * Parses Resume.md and creates a new Reactive Resume resume from it via the
 * API: create → fetch defaults → update with the parsed data.
 *
 * Needs RXRESUME_API_KEY, RXRESUME_API_URL and RXRESUME_APP_URL in the
 * environment (see .env.example).
 */

import { readFileSync } from "fs";
import { randomUUID } from "crypto";
import { parseResume } from "../sync-resume/parser.ts";
import { toResumeData } from "../rx-resume/resume-data.ts";
import { createRxResumeClient } from "../rx-resume/client.ts";
import { resolveApiConfig, resolveBuilderUrl } from "../rx-resume/config.ts";
import type { Env } from "../rx-resume/types.ts";
import { generateResume } from "./generate.ts";
import type { GenerateOptions } from "./types.ts";

const UTF8 = "utf-8";

/**
 * Creates a Reactive Resume resume from Resume.md and prints its builder link.
 *
 * @param options - The resume path and the new resume's name, slug and tags.
 * @param env - Environment holding the Reactive Resume API settings.
 * @throws If an API variable is missing, Resume.md fails validation, or the
 *   API rejects a request.
 *
 * @example
 * await runGenerate({ resume, name, slug, tags }, process.env);
 * // ✓ Created "Jane Doe" (slug jane-doe, id …)
 * //   builder: https://rxresu.me/builder/…
 */
export async function runGenerate(
  options: GenerateOptions,
  env: Env,
): Promise<void> {
  const config = resolveApiConfig(env);
  const data = toResumeData(parseResume(readFileSync(options.resume, UTF8)));

  const client = createRxResumeClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    fetch: globalThis.fetch,
  });
  const resume = await generateResume(
    client,
    { name: options.name, slug: options.slug, tags: options.tags, data },
    randomUUID,
  );

  console.log(
    `✓ Created "${resume.name}" (slug ${resume.slug}, id ${resume.id})`,
  );
  console.log(`  builder: ${resolveBuilderUrl(config.appUrl, resume.id)}`);
}
