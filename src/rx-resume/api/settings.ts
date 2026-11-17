/**
 * settings.ts
 *
 * Builds, saves and reads the Reactive Resume settings, and connects to the
 * API. Connect saves them to the settings file; a `.env` in the current
 * folder or the shell can override them. Every run receives them as
 * environment variables, so neither the API key nor the instance URLs appear
 * in code or in git.
 */

import type { EnvironmentVariables, FetchFunction } from "../../utils/types.ts";
import { RxResumeApiClient, trimTrailingSlashes } from "./client.ts";
import {
  type ApiCallLog,
  EnvironmentVariable,
  OptionalEnvironmentVariable,
} from "./types.ts";

/** Where an instance serves its REST API, after its address. */
const API_PATH = "/api/openapi";

/** Every Reactive Resume setting, as Connect saves it. */
export type RxResumeSettings = Record<EnvironmentVariable, string>;

/**
 * Builds the settings for one Reactive Resume instance from its address.
 *
 * @param address - The instance's address, e.g. `https://rxresu.me`, with
 *   or without a slash at its end.
 * @param apiKey - The API key from the account's settings.
 * @returns The key, the API's URL under the address, and the address, both
 *   without a slash at their end.
 *
 * @example
 * settingsFor("https://rxresu.me", "rr_abc");
 * // { RXRESUME_API_KEY: "rr_abc",
 * //   RXRESUME_API_URL: "https://rxresu.me/api/openapi",
 * //   RXRESUME_APP_URL: "https://rxresu.me" }
 */
export function settingsFor(address: string, apiKey: string): RxResumeSettings {
  const appUrl = trimTrailingSlashes(address);
  return {
    [EnvironmentVariable.ApiKey]: apiKey,
    [EnvironmentVariable.ApiUrl]: `${appUrl}${API_PATH}`,
    [EnvironmentVariable.AppUrl]: appUrl,
  };
}

/** The variable a `NAME=value` line sets, or the whole line when it sets none. */
function variableNameOf(line: string): string {
  const [variableName = ""] = line.split("=");
  return variableName.trim();
}

/**
 * Rewrites the saved settings with new Reactive Resume settings, keeping
 * every other line, such as another platform's settings, as it was.
 *
 * @param savedText - The saved settings file's text, or "" when there is none.
 * @param settings - Every Reactive Resume setting.
 * @returns The other lines, then one `NAME=value` line per setting, each
 *   ending in a newline.
 *
 * @example
 * replaceSavedSettings(
 *   "OTHER_API_KEY=x\nRXRESUME_API_KEY=old\n",
 *   settingsFor("https://rxresu.me", "rr_abc"),
 * );
 * // "OTHER_API_KEY=x\nRXRESUME_API_KEY=rr_abc\nRXRESUME_API_URL=…"
 */
export function replaceSavedSettings(
  savedText: string,
  settings: RxResumeSettings,
): string {
  const replacedNames = new Set<string>(Object.keys(settings));
  const keptLines = savedText
    .split("\n")
    .filter((line) => !replacedNames.has(variableNameOf(line)));
  // Splitting text that ends in a newline leaves an empty last line.
  while (keptLines.at(-1) === "") keptLines.pop();
  const settingLines = Object.entries(settings).map(
    ([variableName, value]) => `${variableName}=${value}`,
  );
  return [...keptLines, ...settingLines].map((line) => `${line}\n`).join("");
}

/** The settings that are missing or empty. */
function missingSettings(
  environmentVariables: EnvironmentVariables,
): EnvironmentVariable[] {
  return Object.values(EnvironmentVariable).filter(
    (variableName) => !environmentVariables[variableName],
  );
}

/**
 * Tells whether Reactive Resume is connected: every setting Connect saves is
 * there and not empty.
 *
 * @param environmentVariables - The saved settings, under the shell's and the
 *   current folder's `.env`.
 * @returns True when the tools can connect to the API.
 *
 * @example
 * isConnected({ RXRESUME_API_KEY: "" }); // false
 */
export function isConnected(
  environmentVariables: EnvironmentVariables,
): boolean {
  return missingSettings(environmentVariables).length === 0;
}

/**
 * Connects to the Reactive Resume instance the settings name.
 *
 * @param environmentVariables - Where the settings were loaded,
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
    const missing = missingSettings(environmentVariables).join(", ");
    throw new Error(`Missing ${missing}. Run Connect first.`);
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
