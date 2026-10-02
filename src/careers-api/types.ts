/**
 * types.ts
 *
 * Every type the careers API adapter uses, in one place. API shapes
 * are inferred from the Zod schemas in schema.ts; only the shapes that are not
 * data (the client, its config) are declared here by hand.
 */

import type { z } from "zod";
import type {
  ApplicationPayloadSchema,
  ApplicationResponseSchema,
  VacancySchema,
} from "./schema.ts";

// ─── API shapes ───────────────────────────────────────────────────────────────

/** The body of `POST /api/apply/{vacancy}`. */
export type ApplicationPayload = z.infer<typeof ApplicationPayloadSchema>;
export type Vacancy = z.infer<typeof VacancySchema>;
export type ApplicationResponse = z.infer<typeof ApplicationResponseSchema>;

// ─── Results ──────────────────────────────────────────────────────────────────

/** What the API did with an application, read from the response status. */
export const ApplyOutcome = {
  /** 200: validated only; nothing was saved or sent to a recruiter. */
  Tested: "tested",
  /** 201: the application was accepted. */
  Applied: "applied",
} as const;
export type ApplyOutcome = (typeof ApplyOutcome)[keyof typeof ApplyOutcome];

/** A response as the API sent it, for printing in full. */
export interface ApiResponse {
  status: number;
  /** Empty when the server sends none, as HTTP/2 servers do. */
  statusText: string;
  /** The body exactly as received; empty when there was none. */
  body: string;
}

export interface ApplicationResult {
  outcome: ApplyOutcome;
  /** The reply body, or undefined when it didn't have the documented shape. */
  reply: ApplicationResponse | undefined;
  /** The whole response, whatever its shape. */
  response: ApiResponse;
}

// ─── Client and config ────────────────────────────────────────────────────────

/** The subset of `fetch` the client uses; `globalThis.fetch` satisfies it. */
export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export interface CareersClientConfig {
  /** The apply endpoint without a vacancy, e.g. `https://…/api/apply`. */
  baseUrl: string;
  fetch: FetchFn;
}

export interface CareersClient {
  /** `POST {baseUrl}/{vacancy}`; rejects with CareersApiError on a non-2xx. */
  apply(
    vacancy: string,
    payload: ApplicationPayload,
  ): Promise<ApplicationResult>;
}

/** Environment variables, usually `process.env` after Bun has loaded `.env`. */
export type Env = Record<string, string | undefined>;

export interface CareersConfig {
  /** The apply endpoint without a vacancy, e.g. `https://…/api/apply`. */
  baseUrl: string;
}
