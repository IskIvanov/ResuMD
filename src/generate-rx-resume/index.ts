/**
 * generate-rx-resume/index.ts
 *
 * Parses Resume.md and creates a new Reactive Resume resume from it via the
 * API: create → fetch defaults → update with the parsed data.
 *
 * Needs RXRESUME_API_KEY, RXRESUME_API_URL and RXRESUME_APP_URL in a .env file
 * in the working directory (see .env.example); Bun loads it automatically.
 *
 * Run: bun src/generate-rx-resume/index.ts --resume <path> --name <name>
 *        [--slug <slug>] [--tags <a,b>]
 */

import { readFileSync } from "fs";
import { randomUUID } from "crypto";
import { parseResume } from "../sync-resume/parser.ts";
import { toResumeData } from "../rx-resume/resume-data.ts";
import { createRxResumeClient } from "../rx-resume/client.ts";
import { resolveApiConfig, resolveBuilderUrl } from "../rx-resume/config.ts";
import { resolveGenerateOptions } from "./cli.ts";
import { generateResume } from "./generate.ts";

try {
  const options = resolveGenerateOptions(process.argv.slice(2), process.cwd());
  const config = resolveApiConfig(process.env);
  const data = toResumeData(parseResume(readFileSync(options.resume, "utf-8")));

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
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
