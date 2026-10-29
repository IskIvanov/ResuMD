/**
 * config.ts
 *
 * Reads the Reactive Resume settings. They live in a `.env` file (see
 * `.env.example`), which Bun loads into the environment, so neither the API
 * key nor the instance URLs appear in code, on the command line or in git.
 */

import { itemPath, trimTrailingSlashes } from "../utils/url.ts";
import type { ApiConfig, Env, RequestLog } from "./types.ts";

/** Variables the Reactive Resume tools need from `.env`. */
export enum EnvVar {
  ApiKey = "RXRESUME_API_KEY",
  BaseUrl = "RXRESUME_API_URL",
  AppUrl = "RXRESUME_APP_URL",
}

/** Variables the tools read when set, and never ask for. */
export enum OptionalEnvVar {
  /** Any non-empty value logs every API request to stderr. */
  Debug = "RXRESUME_DEBUG",
}

/** Writes request lines to stderr, timed with the process clock. */
export const STDERR_REQUEST_LOG: RequestLog = {
  write: (line) => console.error(line),
  now: () => performance.now(),
};

/** The file the variables belong in. */
export const ENV_FILE = ".env";
const ENV_EXAMPLE_FILE = ".env.example";
const BUILDER_PATH = "/builder";
const LETTER_DASHBOARD_PATH = "/dashboard";

/**
 * Resolves the API key and the instance URLs from an environment.
 *
 * @param env - The environment to read, usually `process.env` after Bun has
 *   loaded `.env`.
 * @returns The API key, API base URL and app URL.
 * @throws If any variable is missing or empty, naming each one.
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
    throw new Error(
      `Missing ${missing.join(", ")}. Copy ${ENV_EXAMPLE_FILE} to ` +
        `${ENV_FILE} and fill it in.`,
    );
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
  try {
    resolveApiConfig(env);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
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
