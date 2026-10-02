/**
 * config.ts
 *
 * Reads the careers API settings. The endpoint lives in a `.env`
 * file (see `.env.example`), which Bun loads into the environment, so it can
 * be pointed at another host without a code change.
 */

import type { Env, CareersConfig } from "./types.ts";

/** Variables the job application tools need from `.env`. */
export enum EnvVar {
  ApiUrl = "CAREERS_API_URL",
}

/** The file the variables belong in. */
export const ENV_FILE = ".env";
const ENV_EXAMPLE_FILE = ".env.example";

/**
 * Resolves the apply endpoint from an environment.
 *
 * @param env - The environment to read, usually `process.env` after Bun has
 *   loaded `.env`.
 * @returns The apply endpoint, without a vacancy slug.
 * @throws If the variable is missing or empty.
 *
 * @example
 * resolveCareersConfig(process.env);
 * // { baseUrl: "https://careers.example.com/api/apply" }
 */
export function resolveCareersConfig(env: Env): CareersConfig {
  const baseUrl = env[EnvVar.ApiUrl];
  if (!baseUrl) {
    throw new Error(
      `Missing ${EnvVar.ApiUrl}. Copy ${ENV_EXAMPLE_FILE} to ${ENV_FILE} ` +
        `and fill it in.`,
    );
  }
  return { baseUrl };
}

/**
 * Explains why the careers API can't be used, for a tool's preflight.
 *
 * @param env - The environment to read.
 * @returns The missing-variable message, or undefined when it is set.
 *
 * @example
 * careersConfigProblem({}); // "Missing CAREERS_API_URL. Copy .env.example …"
 */
export function careersConfigProblem(env: Env): string | undefined {
  try {
    resolveCareersConfig(env);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
