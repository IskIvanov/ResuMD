/**
 * schema.ts
 *
 * Zod schemas for the careers API: the application it accepts on
 * `POST /api/apply/{vacancy}` and the reply it sends. They are the source of
 * truth for the types in types.ts.
 *
 * The API itself requires only the name and email. These rules are stricter:
 * every field is required, the phone number must be Dutch and the profile
 * links must point at a LinkedIn and a GitHub profile.
 */

import { z } from "zod";
import { Base64Schema } from "../cv-base64/schema.ts";
import { parseOrThrow } from "../utils/schema.ts";
import type { ApplicationPayload } from "./types.ts";

/** CV formats the API accepts, spelled as it expects them: no leading dot. */
export const CvExtension = {
  Pdf: "pdf",
  Docx: "docx",
  Markdown: "md",
} as const;

/** The API rejects a longer motivation. */
export const MOTIVATION_MAX_LENGTH = 5000;

const BYTES_PER_MB = 1_000_000;

/**
 * The API rejects a larger request, CV included. Counted in decimal megabytes,
 * the stricter reading of "4MB", so a 4 MiB server limit is never hit either.
 */
export const MAX_REQUEST_BYTES = 4 * BYTES_PER_MB;

/** Messages reported for an application field that fails its rule. */
export const ApplicationMessage = {
  Required: "required",
  Email: "expected an email address",
  DutchPhone:
    "expected a Dutch phone number, e.g. 06 12345678 or +31 6 12345678",
  TooLong: `at most ${MOTIVATION_MAX_LENGTH} characters`,
  CvExtension: "expected pdf, docx or md",
  LinkedInProfile:
    "expected a LinkedIn profile URL, e.g. https://www.linkedin.com/in/jane-doe",
  GitHubProfile:
    "expected a GitHub profile URL, e.g. https://github.com/jane-doe",
  RequestTooLarge: `over the ${MAX_REQUEST_BYTES / BYTES_PER_MB} MB request limit, CV included; use a smaller file`,
} as const;

const ERROR_HEADING = "Invalid application:";

// ─── Field rules ──────────────────────────────────────────────────────────────

/** Text that is still there after trimming. Stops at the first failure. */
const requiredText = z
  .string()
  .trim()
  .min(1, { error: ApplicationMessage.Required, abort: true });

/** Separators people type in phone numbers; dropped before matching. */
const PHONE_SEPARATORS = /[\s\-.()]/g;
/** The "(0)" in "+31 (0)6 …", which is never dialled after +31. */
const BRACKETED_TRUNK_ZERO = /\(0\)/g;
/** +31, 0031 or a leading 0, then nine digits that don't start with 0. */
const DUTCH_PHONE = /^(?:\+31|0031|0)[1-9]\d{8}$/;

/**
 * Checks that a phone number is Dutch, in any common way of writing one.
 *
 * @param value - The number as typed, with spaces, dashes or dots.
 * @returns True for a Dutch mobile or landline number.
 *
 * @example
 * isDutchPhoneNumber("+31 (0)6 12345678"); // true
 * isDutchPhoneNumber("+44 7911 123456"); // false
 */
export function isDutchPhoneNumber(value: string): boolean {
  const digits = value
    .replace(BRACKETED_TRUNK_ZERO, "")
    .replace(PHONE_SEPARATORS, "");
  return DUTCH_PHONE.test(digits);
}

const HTTPS = "https:";
/** linkedin.com, www.linkedin.com or a country subdomain like nl.linkedin.com. */
const LINKEDIN_HOST = /^(?:[a-z]{2,3}\.)?linkedin\.com$/;
const LINKEDIN_PROFILE_PATH = /^\/in\/[^/]+\/?$/;
const GITHUB_HOST = /^(?:www\.)?github\.com$/;
const GITHUB_PROFILE_PATH = /^\/[A-Za-z0-9-]+\/?$/;

/** An https URL whose host and path match, reported with one message. */
function profileUrl(
  host: RegExp,
  path: RegExp,
  message: string,
): z.ZodType<string> {
  return requiredText.refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return (
      url.protocol === HTTPS &&
      host.test(url.hostname) &&
      path.test(url.pathname)
    );
  }, message);
}

// ─── Application ──────────────────────────────────────────────────────────────

/**
 * The size of the request body sent for a payload: its JSON in UTF-8, which
 * is exactly how the client serializes it.
 */
function requestBytes(payload: unknown): number {
  return Buffer.byteLength(JSON.stringify(payload), "utf8");
}

/** Formats a byte count as megabytes, e.g. "5.37". */
function toMegabytes(bytes: number): string {
  return (bytes / BYTES_PER_MB).toFixed(2);
}

export const ApplicationPayloadSchema = z
  .object({
    first_name: requiredText,
    last_name: requiredText,
    email: z.email(ApplicationMessage.Email),
    telephone: requiredText.refine(
      isDutchPhoneNumber,
      ApplicationMessage.DutchPhone,
    ),
    motivation: requiredText.max(
      MOTIVATION_MAX_LENGTH,
      ApplicationMessage.TooLong,
    ),
    /** The CV file as bare base64, without a data URL prefix. */
    cv: Base64Schema,
    cv_extension: z.enum(CvExtension, ApplicationMessage.CvExtension),
    linkedin_url: profileUrl(
      LINKEDIN_HOST,
      LINKEDIN_PROFILE_PATH,
      ApplicationMessage.LinkedInProfile,
    ),
    github_url: profileUrl(
      GITHUB_HOST,
      GITHUB_PROFILE_PATH,
      ApplicationMessage.GitHubProfile,
    ),
    /** True: validate only and save nothing. False: apply for real. */
    test: z.boolean(),
  })
  // The CV is nearly all of the request, so the issue is reported on it.
  .superRefine((payload, ctx) => {
    const bytes = requestBytes(payload);
    if (bytes <= MAX_REQUEST_BYTES) return;
    ctx.addIssue({
      code: "custom",
      path: ["cv"],
      message: `makes the request ${toMegabytes(bytes)} MB, ${ApplicationMessage.RequestTooLarge}`,
    });
  });

/**
 * Checks an application against ApplicationPayloadSchema.
 *
 * @param payload - The application assembled from the CLI's values.
 * @returns The validated application, with text fields trimmed.
 * @throws If any field fails its rule, or the request would be larger than
 *   MAX_REQUEST_BYTES; the error lists every failure, e.g.
 *   `telephone: expected a Dutch phone number, …`.
 *
 * @example
 * validateApplicationPayload({ ...payload, email: "jane@" });
 * // Error: Invalid application:
 * //   email: expected an email address
 */
export function validateApplicationPayload(
  payload: unknown,
): ApplicationPayload {
  return parseOrThrow(ApplicationPayloadSchema, payload, ERROR_HEADING);
}

// ─── Reply ────────────────────────────────────────────────────────────────────

export const VacancySchema = z.object({
  slug: z.string(),
  title: z.string(),
  department: z.string(),
});

/**
 * The reply to an application. The docs only show the reply to a test call,
 * so every field is optional: a reply in another shape to a real application
 * must not be mistaken for a failure.
 */
export const ApplicationResponseSchema = z.object({
  ok: z.boolean().optional(),
  test: z.boolean().optional(),
  message: z.string().optional(),
  vacancy: VacancySchema.optional(),
});
