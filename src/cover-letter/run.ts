/**
 * run.ts
 *
 * Reads a cover-letter `.md` and creates or rewrites a Reactive Resume cover
 * letter from it via the API, or permanently deletes one, then prints what
 * it did.
 *
 * Needs RXRESUME_API_KEY, RXRESUME_API_URL and RXRESUME_APP_URL in the
 * environment (see .env.example).
 */

import { readFileSync } from "fs";
import { DateTime } from "luxon";
import { RxResumeApiClient } from "../rx-resume/client.ts";
import {
  resolveApiConfig,
  resolveLetterDashboardUrl,
  resolveRequestLog,
  STDERR_REQUEST_LOG,
} from "../rx-resume/config.ts";
import type {
  CoverLetter,
  CoverLetterTemplate,
  Env,
  RxResumeClient,
  RxResumeClientConfig,
} from "../rx-resume/types.ts";
import { toCreateBody, toUpdateBody } from "./body.ts";
import { deleteCoverLetter } from "./delete.ts";
import { generateCoverLetter } from "./generate.ts";
import { parseCoverLetter } from "./parser.ts";
import {
  CoverLetterLabel,
  type DeleteCoverLetterOptions,
  type GenerateCoverLetterOptions,
  type UpdateCoverLetterOptions,
} from "./types.ts";
import { updateCoverLetter } from "./update.ts";

const UTF8 = "utf-8";

/** Today's date in the local time zone, as `YYYY-MM-DD`. */
function localToday(): string {
  return DateTime.now().toISODate();
}

/** A client for the API that `env` configures, and the app URL for links. */
function connect(env: Env): { client: RxResumeClient; appUrl: string } {
  const config = resolveApiConfig(env);
  const clientConfig: RxResumeClientConfig = {
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    fetch: globalThis.fetch,
    requestLog: resolveRequestLog(env, STDERR_REQUEST_LOG),
  };
  const client = new RxResumeApiClient(clientConfig);
  return { client, appUrl: config.appUrl };
}

/**
 * Prints what happened to a letter and links to it on the dashboard. The
 * template is shown only when --template was given, since the letter then
 * no longer follows the resume's design.
 */
function printLetter(
  label: CoverLetterLabel,
  letter: CoverLetter,
  template: CoverLetterTemplate | undefined,
  appUrl: string,
): void {
  const details = [`id ${letter.id}`, `revision ${letter.revision}`];
  if (template) details.push(`template ${template}`);
  console.log(`${label} "${letter.name}" (${details.join(", ")})`);
  console.log(
    `${CoverLetterLabel.LetterLink} ${resolveLetterDashboardUrl(appUrl, letter.id)}`,
  );
}

/**
 * Creates a cover letter from a `.md` and prints its id and revision.
 *
 * @param options - The `.md` path, the letter's name, the resume it goes
 *   with and any optional flags.
 * @param env - Environment holding the Reactive Resume API settings.
 * @param today - The letter's date, as `YYYY-MM-DD`; defaults to today in the
 *   local time zone.
 * @throws If an API variable is missing, the `.md` fails validation, a flag
 *   breaks the API's rules, or the API rejects the request.
 *
 * @example
 * await runGenerateCoverLetter({ letter, name, resumeId }, process.env);
 * // ✓ Created cover letter "Acme — Frontend" (id …, revision 1)
 * //   letter: https://rxresu.me/dashboard/…
 */
export async function runGenerateCoverLetter(
  options: GenerateCoverLetterOptions,
  env: Env,
  today: string = localToday(),
): Promise<void> {
  const { client, appUrl } = connect(env);
  const parsed = parseCoverLetter(readFileSync(options.letter, UTF8));

  const letter = await generateCoverLetter(
    client,
    toCreateBody(parsed, options, today),
  );
  printLetter(CoverLetterLabel.Created, letter, options.template, appUrl);
}

/**
 * Rewrites an existing cover letter from a `.md` and prints its new revision.
 *
 * @param options - The letter's id, the `.md` path and any optional flags;
 *   a flag not given keeps the stored value.
 * @param env - Environment holding the Reactive Resume API settings.
 * @param today - The letter's date, as `YYYY-MM-DD`; defaults to today in the
 *   local time zone.
 * @throws If an API variable is missing, the `.md` fails validation, a flag
 *   breaks the API's rules, or the API rejects a request (e.g. an unknown id,
 *   a locked letter, or an edit made since it was read).
 *
 * @example
 * await runUpdateCoverLetter({ id, letter }, process.env);
 * // ✓ Updated cover letter "Acme — Frontend" (id …, revision 4)
 * //   letter: https://rxresu.me/dashboard/…
 */
export async function runUpdateCoverLetter(
  options: UpdateCoverLetterOptions,
  env: Env,
  today: string = localToday(),
): Promise<void> {
  const { client, appUrl } = connect(env);
  const parsed = parseCoverLetter(readFileSync(options.letter, UTF8));

  const letter = await updateCoverLetter(client, options.id, (revision) =>
    toUpdateBody(parsed, options, revision, today),
  );
  printLetter(CoverLetterLabel.Updated, letter, options.template, appUrl);
}

/**
 * Permanently deletes a cover letter: moves it to Trash, then purges it.
 *
 * @param options - The letter's id.
 * @param env - Environment holding the Reactive Resume API settings.
 * @throws If an API variable is missing or the API rejects a request (e.g. a
 *   locked letter). If only the purge fails, the error says the letter is in
 *   Trash.
 *
 * @example
 * await runDeleteCoverLetter({ id }, process.env);
 * // ✓ Permanently deleted cover letter …
 */
export async function runDeleteCoverLetter(
  options: DeleteCoverLetterOptions,
  env: Env,
): Promise<void> {
  const { client } = connect(env);
  await deleteCoverLetter(client, options.id);
  console.log(`${CoverLetterLabel.Deleted} ${options.id}`);
}
