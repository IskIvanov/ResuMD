/**
 * index.ts
 *
 * The Reactive Resume platform's only entry point. A tool connects once with
 * the settings and its dependencies, then calls operations on the returned
 * handle; the client, config, mapping and request shapes stay behind it. To
 * add or remove a group of operations, add or remove its folder and its one
 * line below.
 */

import { RxResumeApiClient } from "./client.ts";
import { resolveApiConfig, resolveRequestLog } from "./config.ts";
import { coverLetterOperations } from "./cover-letter/operations.ts";
import { resumeOperations } from "./resume/operations.ts";
import type { RequestLog, RxResume, RxResumeDeps } from "./types.ts";

export { RxResumeApiError } from "./client.ts";
export {
  apiConfigProblem as rxResumeProblem,
  STDERR_REQUEST_LOG,
} from "./config.ts";
export { CoverLetterIdSchema } from "./cover-letter/schema.ts";
export { RxResumeError } from "./errors.ts";
export {
  CoverLetterTemplate,
  EnvVar as RxResumeEnvVar,
  OptionalEnvVar as RxResumeOptionalEnvVar,
  RxResumeErrorCode,
} from "./types.ts";
export type {
  CoverLetterResult,
  GenerateCoverLetterInput,
  GenerateResumeInput,
  ResumeResult,
  RxResume,
  RxResumeDeps,
  UpdateCoverLetterInput,
  UpdateResumeInput,
} from "./types.ts";

/**
 * Connects to the Reactive Resume API that `deps.env` configures.
 *
 * @param deps - The environment holding the `.env` settings, the `fetch` to
 *   send requests with, the id factory for new items, today's date and,
 *   optionally, where to log requests when RXRESUME_DEBUG is set.
 * @returns The operations, grouped by what they act on.
 * @throws An RxResumeError if a setting is missing, naming each one.
 *
 * @example
 * const rx = connectRxResume({ env: process.env, fetch, newId, today });
 * await rx.resumes.update({ id: "resume-1", markdown });
 */
export function connectRxResume(deps: RxResumeDeps): RxResume {
  const { apiKey, baseUrl, appUrl } = resolveApiConfig(deps.env);
  let requestLog: RequestLog | undefined;
  if (deps.requestLog)
    requestLog = resolveRequestLog(deps.env, deps.requestLog);
  const client = new RxResumeApiClient({
    apiKey,
    baseUrl,
    fetch: deps.fetch,
    requestLog,
  });

  return {
    resumes: resumeOperations(client, appUrl, deps.newId),
    coverLetters: coverLetterOperations(client, appUrl, deps.today),
  };
}
