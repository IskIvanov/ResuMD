/**
 * config.ts
 *
 * Reads the Reactive Resume settings. They live in a `.env` file (see
 * `.env.example`), which Bun loads into the environment, so neither the API
 * key nor the instance URLs appear in code, on the command line or in git.
 */

import type { ApiConfig } from "./types.ts";

/** Variables the Reactive Resume tools need from `.env`. */
export const EnvVar = {
  ApiKey: "RXRESUME_API_KEY",
  BaseUrl: "RXRESUME_API_URL",
  AppUrl: "RXRESUME_APP_URL",
} as const;

/** The file the variables belong in. */
export const ENV_FILE = ".env";
const ENV_EXAMPLE_FILE = ".env.example";
const BUILDER_PATH = "/builder";

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
export function resolveApiConfig(
  env: Record<string, string | undefined>,
): ApiConfig {
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
  const origin = appUrl.replace(/\/+$/, "");
  return `${origin}${BUILDER_PATH}/${encodeURIComponent(resumeId)}`;
}
