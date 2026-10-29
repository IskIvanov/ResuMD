/**
 * config.ts
 *
 * Reads the Reactive Resume settings and connects to the API. They live in a
 * `.env` file (see `.env.example`), which Bun loads into the environment, so
 * neither the API key nor the instance URLs appear in code, on the command
 * line or in git.
 */

import type { Env, FetchFn } from "../../utils/types.ts";
import { RxResumeApiClient } from "./client.ts";
import { EnvVar, OptionalEnvVar, type RequestLog } from "./types.ts";

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
  const missing = Object.values(EnvVar).filter((name) => !env[name]);
  if (missing.length === 0) return undefined;
  return `Missing ${missing.join(", ")}. Copy .env.example to .env and fill it in.`;
}

/**
 * Connects to the Reactive Resume API that `env` configures.
 *
 * @param env - The environment holding the `.env` settings, usually
 *   `process.env` after Bun has loaded `.env`.
 * @param fetch - Sends the requests.
 * @param requestLog - Where a line per request and response goes when
 *   RXRESUME_DEBUG is set.
 * @returns A client for the configured instance.
 * @throws If a setting is missing or empty, naming each one.
 *
 * @example
 * await connectRxResume(process.env, fetch, log).deleteResume(id);
 */
export function connectRxResume(
  env: Env,
  fetch: FetchFn,
  requestLog: RequestLog,
): RxResumeApiClient {
  const apiKey = env[EnvVar.ApiKey];
  const baseUrl = env[EnvVar.BaseUrl];
  const appUrl = env[EnvVar.AppUrl];
  if (!apiKey || !baseUrl || !appUrl) {
    throw new Error(apiConfigProblem(env));
  }

  let debugLog: RequestLog | undefined;
  if (env[OptionalEnvVar.Debug]) debugLog = requestLog;
  return new RxResumeApiClient({
    apiKey,
    baseUrl,
    appUrl,
    fetch,
    requestLog: debugLog,
  });
}
