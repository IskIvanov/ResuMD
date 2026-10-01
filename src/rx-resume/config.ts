/**
 * config.ts
 *
 * Reads the Reactive Resume settings. They live in a `.env` file (see
 * `.env.example`), which Bun loads into the environment, so neither the API
 * key nor the instance URLs appear in code, on the command line or in git.
 */

import type { ApiConfig, Env } from "./types.ts";

/** Variables the Reactive Resume tools need from `.env`. */
export enum EnvVar {
  ApiKey = "RXRESUME_API_KEY",
  BaseUrl = "RXRESUME_API_URL",
  AppUrl = "RXRESUME_APP_URL",
}

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
