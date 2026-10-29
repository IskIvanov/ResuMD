/**
 * settings.ts
 *
 * Reads the Reactive Resume settings and connects to the API. They live in a
 * `.env` file (see `.env.example`), which Bun loads into the environment
 * variables, so neither the API key nor the instance URLs appear in code, on
 * the command line or in git.
 */

import type { EnvironmentVariables, FetchFunction } from "../../utils/types.ts";
import { RxResumeApiClient } from "./client.ts";
import {
  type ApiCallLog,
  EnvironmentVariable,
  OptionalEnvironmentVariable,
} from "./types.ts";

/**
 * Explains why the Reactive Resume API can't be used, for a tool's preflight.
 *
 * @param environmentVariables - Where the `.env` settings were loaded.
 * @returns Which settings are missing and how to add them, or undefined when
 *   every setting is there.
 *
 * @example
 * describeMissingSettings({}); // "Missing RXRESUME_API_KEY, … Copy .env.example …"
 */
export function describeMissingSettings(
  environmentVariables: EnvironmentVariables,
): string | undefined {
  const missing = Object.values(EnvironmentVariable).filter(
    (variableName) => !environmentVariables[variableName],
  );
  if (missing.length === 0) return undefined;
  return `Missing ${missing.join(", ")}. Copy .env.example to .env and fill it in.`;
}

/**
 * Connects to the Reactive Resume instance the `.env` settings name.
 *
 * @param environmentVariables - Where the `.env` settings were loaded,
 *   usually `process.env`.
 * @param fetch - Calls the API.
 * @param apiCallLog - Where a line per API call and its answer goes when
 *   RXRESUME_DEBUG is set.
 * @returns A client for that instance.
 * @throws If a setting is missing or empty, naming each one.
 *
 * @example
 * await connectRxResume(process.env, fetch, log).trashResume(id);
 */
export function connectRxResume(
  environmentVariables: EnvironmentVariables,
  fetch: FetchFunction,
  apiCallLog: ApiCallLog,
): RxResumeApiClient {
  const apiKey = environmentVariables[EnvironmentVariable.ApiKey];
  const apiUrl = environmentVariables[EnvironmentVariable.ApiUrl];
  const appUrl = environmentVariables[EnvironmentVariable.AppUrl];
  if (!apiKey || !apiUrl || !appUrl) {
    throw new Error(describeMissingSettings(environmentVariables));
  }

  let debugLog: ApiCallLog | undefined;
  if (environmentVariables[OptionalEnvironmentVariable.Debug]) {
    debugLog = apiCallLog;
  }
  return new RxResumeApiClient({
    apiKey,
    apiUrl,
    appUrl,
    fetch,
    apiCallLog: debugLog,
  });
}
