/**
 * config.ts
 *
 * Reads the Reactive Resume settings. They live in a `.env` file (see
 * `.env.example`), which Bun loads into the environment, so neither the API
 * key nor the instance URLs appear in code, on the command line or in git.
 */

import { failureOf } from "../utils/error.ts";
import type { Env } from "../utils/types.ts";
import { itemPath, trimTrailingSlashes } from "../utils/url.ts";
import { RxResumeError } from "./errors.ts";
import {
  type ApiConfig,
  EnvVar,
  OptionalEnvVar,
  type RequestLog,
  RxResumeErrorCode,
} from "./types.ts";

/** Writes request lines to stderr, timed with the process clock. */
export const STDERR_REQUEST_LOG: RequestLog = {
  write: (line) => console.error(line),
  now: () => performance.now(),
};

const BUILDER_PATH = "/builder";
const LETTER_DASHBOARD_PATH = "/dashboard";

/**
 * Resolves the API key and the instance URLs from an environment.
 *
 * @param env - The environment to read, usually `process.env` after Bun has
 *   loaded `.env`.
 * @returns The API key, API base URL and app URL.
 * @throws An RxResumeError if any variable is missing or empty, naming each
 *   one.
 *
 * @example
 * resolveApiConfig(process.env);
 * // { apiKey: "…", baseUrl: "https://…/api/openapi", appUrl: "https://…" }
 */
export function resolveApiConfig(env: Env): ApiConfig {
  const apiKey = env[EnvVar.ApiKey];
  const baseUrl = env[EnvVar.BaseUrl];
  const appUrl = env[EnvVar.AppUrl];

  if (!apiKey || !baseUrl || !appUrl) {
    const missing = Object.values(EnvVar).filter((name) => !env[name]);
    throw new RxResumeError({
      code: RxResumeErrorCode.MissingSettings,
      missing,
    });
  }

  return { apiKey, baseUrl, appUrl };
}

/**
 * Explains why the Reactive Resume API can't be used, for a tool's preflight.
 *
 * @param env - The environment to read.
 * @returns The missing-variable message, or undefined when every variable is
 *   set.
 *
 * @example
 * apiConfigProblem({}); // "Missing RXRESUME_API_KEY, … Copy .env.example …"
 */
export function apiConfigProblem(env: Env): string | undefined {
  return failureOf(() => resolveApiConfig(env));
}

/**
 * Turns the client's request log on when RXRESUME_DEBUG is set.
 *
 * @param env - The environment to read.
 * @param requestLog - Where the lines go when debugging is on.
 * @returns `requestLog` when RXRESUME_DEBUG is non-empty, else undefined.
 *
 * @example
 * resolveRequestLog({ RXRESUME_DEBUG: "1" }, STDERR_REQUEST_LOG);
 * // STDERR_REQUEST_LOG
 */
export function resolveRequestLog(
  env: Env,
  requestLog: RequestLog,
): RequestLog | undefined {
  if (!env[OptionalEnvVar.Debug]) return undefined;
  return requestLog;
}

/**
 * Builds the link that opens a resume in the Reactive Resume builder.
 *
 * @param appUrl - URL of the web app, with or without a trailing slash.
 * @param resumeId - The resume's id.
 * @returns The builder URL.
 *
 * @example
 * resolveBuilderUrl("https://rxresu.me", "abc");
 * // "https://rxresu.me/builder/abc"
 */
export function resolveBuilderUrl(appUrl: string, resumeId: string): string {
  return itemPath(`${trimTrailingSlashes(appUrl)}${BUILDER_PATH}`, resumeId);
}

/**
 * Builds the link to a cover letter on the dashboard.
 *
 * @param appUrl - URL of the web app, with or without a trailing slash.
 * @param coverId - The cover letter's id.
 * @returns The letter's dashboard URL, with the id URL-encoded.
 *
 * @example
 * resolveLetterDashboardUrl("https://rxresu.me", "asd-134-sdf-v");
 * // "https://rxresu.me/dashboard/asd-134-sdf-v"
 */
export function resolveLetterDashboardUrl(
  appUrl: string,
  coverId: string,
): string {
  return itemPath(
    `${trimTrailingSlashes(appUrl)}${LETTER_DASHBOARD_PATH}`,
    coverId,
  );
}
