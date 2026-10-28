/**
 * mocks.ts
 *
 * Every fixture the careers API adapter tests use: an environment, a valid
 * application, one invalid variant per field rule, phone numbers and API
 * replies. Typed constants and small factories only.
 */

import { Base64Message } from "../cv-base64/schema.ts";
import { PDF_BASE64, PDF_DATA_URL } from "../cv-base64/mocks.ts";
import { EnvVar } from "./config.ts";
import {
  ApplicationMessage,
  CvExtension,
  MAX_REQUEST_BYTES,
  MOTIVATION_MAX_LENGTH,
} from "./schema.ts";
import type {
  ApiResponse,
  ApplicationPayload,
  ApplicationResponse,
  Env,
} from "./types.ts";

// ─── Config ───────────────────────────────────────────────────────────────────

export const BASE_URL = "https://careers.example/api/apply";
export const VACANCY = "software-engineer";

export const careersEnv: Env = { [EnvVar.ApiUrl]: BASE_URL };

// ─── Payloads ─────────────────────────────────────────────────────────────────

export const validPayload: ApplicationPayload = {
  first_name: "Jane",
  last_name: "Doe",
  email: "jane@example.com",
  telephone: "06 12345678",
  motivation: "I want to help build the energy transition.",
  cv: PDF_BASE64,
  cv_extension: CvExtension.Pdf,
  linkedin_url: "https://www.linkedin.com/in/jane-doe",
  github_url: "https://github.com/jane-doe",
  test: true,
};

/** One broken field of validPayload and the message it must report. */
export interface InvalidFieldCase {
  field: keyof ApplicationPayload;
  value: unknown;
  message: string;
}

export const invalidFieldCases: readonly InvalidFieldCase[] = [
  { field: "first_name", value: "  ", message: ApplicationMessage.Required },
  { field: "email", value: "jane@", message: ApplicationMessage.Email },
  {
    field: "telephone",
    value: "+44 7911 123456",
    message: ApplicationMessage.DutchPhone,
  },
  {
    field: "motivation",
    value: "x".repeat(MOTIVATION_MAX_LENGTH + 1),
    message: ApplicationMessage.TooLong,
  },
  { field: "cv", value: PDF_DATA_URL, message: Base64Message.DataUrl },
  {
    field: "cv_extension",
    value: "txt",
    message: ApplicationMessage.CvExtension,
  },
  {
    field: "linkedin_url",
    value: "https://example.com/in/jane-doe",
    message: ApplicationMessage.LinkedInProfile,
  },
  {
    field: "github_url",
    value: "https://github.com/jane-doe/some-repo",
    message: ApplicationMessage.GitHubProfile,
  },
];

// ─── Request size ─────────────────────────────────────────────────────────────

/** Valid base64 ("A" is in the alphabet) in a length that's a multiple of 4. */
function base64OfLength(length: number): string {
  return "A".repeat(length - (length % 4));
}

/** What validPayload weighs as a request without its CV. */
const BYTES_WITHOUT_CV = Buffer.byteLength(
  JSON.stringify({ ...validPayload, cv: "" }),
);

/** The largest CV that keeps the request within MAX_REQUEST_BYTES. */
export const LARGEST_CV = base64OfLength(MAX_REQUEST_BYTES - BYTES_WITHOUT_CV);

/** A CV that alone fills the limit, so the request goes over it. */
export const OVERSIZED_CV = base64OfLength(MAX_REQUEST_BYTES);

// ─── Phone numbers ────────────────────────────────────────────────────────────

export const DUTCH_PHONE_NUMBERS = [
  "06 12345678",
  "0612345678",
  "+31 6 12345678",
  "+31 (0)6 12345678",
  "0031612345678",
  "020-1234567",
] as const;

export const NON_DUTCH_PHONE_NUMBERS = [
  "+44 7911 123456",
  "0612345",
  "06123456789",
  "not a number",
] as const;

// ─── Replies ──────────────────────────────────────────────────────────────────

/** The documented reply to a test call. */
export const testReply: ApplicationResponse = {
  ok: true,
  test: true,
  message: "This was a test call. Nothing was sent.",
  vacancy: {
    slug: VACANCY,
    title: "Software Engineer",
    department: "Development",
  },
};

/** An API error body, as the API sends it for a 4xx. */
export const notFoundReply = { ok: false, message: "Vacancy not found." };

// ─── Raw responses ────────────────────────────────────────────────────────────

/** The test-call reply as it arrives: status line and raw JSON body. */
export const testCallResponse: ApiResponse = {
  status: 200,
  statusText: "OK",
  body: JSON.stringify(testReply),
};

/** A reply that isn't JSON, as a proxy might send it. */
export const textResponse: ApiResponse = {
  status: 502,
  statusText: "Bad Gateway",
  body: "upstream unavailable",
};

/** A reply with no body and no status text, as HTTP/2 servers send it. */
export const emptyResponse: ApiResponse = {
  status: 201,
  statusText: "",
  body: "",
};

/**
 * Builds a JSON response.
 *
 * @example
 * jsonResponse(testReply); // 200 with a JSON body
 */
export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}
