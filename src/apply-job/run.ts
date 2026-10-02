/**
 * run.ts
 *
 * Reads the CV, builds and validates the application, and sends it to the
 * careers API: as a test call that saves nothing, or for real.
 *
 * Needs CAREERS_API_URL in the environment (see .env.example).
 */

import { readFileSync } from "fs";
import { createCareersClient } from "../careers-api/client.ts";
import { resolveCareersConfig } from "../careers-api/config.ts";
import { formatApiResponse } from "../careers-api/response.ts";
import {
  ApplyOutcome,
  type ApplicationResponse,
  type Env,
} from "../careers-api/types.ts";
import { buildApplicationPayload, parseApplyMode } from "./payload.ts";
import { ApplyMode, CvFile, type ApplyOptions } from "./types.ts";

enum RunLabel {
  Tested = "✓ Test call passed for",
  NothingSent = "Nothing was sent.",
  GoLive = "  Run again with --mode live to apply for real.",
  Applied = "✓ Applied to",
  NotApplied = "You chose --mode live, but the API answered with a test reply, so nothing was sent.",
}

/** The vacancy as the reply names it, or its slug. */
function vacancyName(
  slug: string,
  reply: ApplicationResponse | undefined,
): string {
  const vacancy = reply?.vacancy;
  return vacancy ? `"${vacancy.title}" (${vacancy.department})` : slug;
}

/**
 * Sends an application to the careers API and prints what it did with it,
 * followed by the API's full response.
 *
 * @param options - The vacancy, the applicant's details, the CV path and the
 *   mode.
 * @param env - Environment holding CAREERS_API_URL.
 * @throws If the mode is unknown, the variable is missing, a field fails
 *   validation, the API rejects the request, or a live run comes back as a
 *   test call. Errors from the API also carry its full response.
 *
 * @example
 * await runApply({ vacancy, cv, mode: "test", ...applicant }, process.env);
 * // ✓ Test call passed for "Software Engineer" (Development). Nothing was sent.
 * //   Run again with --mode live to apply for real.
 * //
 * // Response: 200 OK
 * // {
 * //   "ok": true,
 * //   …
 * // }
 */
export async function runApply(options: ApplyOptions, env: Env): Promise<void> {
  const { vacancy, cv, ...applicant } = options;
  const mode = parseApplyMode(options.mode);
  const cvFile: CvFile = { path: cv, bytes: readFileSync(cv) };
  const config = resolveCareersConfig(env);
  const payload = buildApplicationPayload(applicant, cvFile, mode);

  const client = createCareersClient({
    baseUrl: config.baseUrl,
    fetch: globalThis.fetch,
  });
  const { outcome, reply, response } = await client.apply(vacancy, payload);
  const name = vacancyName(vacancy, reply);
  // A blank line, then the API's full response, under every summary.
  const withResponse = (lines: string[]): string =>
    [...lines, "", formatApiResponse(response)].join("\n");

  if (outcome === ApplyOutcome.Applied) {
    console.log(withResponse([`${RunLabel.Applied} ${name}.`]));
    return;
  }
  if (mode === ApplyMode.Live) {
    throw new Error(withResponse([RunLabel.NotApplied]));
  }
  console.log(
    withResponse([
      `${RunLabel.Tested} ${name}. ${RunLabel.NothingSent}`,
      RunLabel.GoLive,
    ]),
  );
}
