/**
 * payload.ts
 *
 * Turns what was typed at the CLI and a CV file into the application the
 * careers API expects, and validates every field before anything
 * is sent.
 */

import { extname } from "path";
import { encodeVerified } from "../cv-base64/codec.ts";
import { validateApplicationPayload } from "../careers-api/schema.ts";
import type { ApplicationPayload } from "../careers-api/types.ts";
import { ApplyMode, type ApplicantDetails, type CvFile } from "./types.ts";

/**
 * Checks the mode typed at the CLI.
 *
 * @param value - The typed mode.
 * @returns The mode, typed.
 * @throws If the value is neither `test` nor `live`.
 *
 * @example
 * parseApplyMode("live"); // ApplyMode.Live
 */
export function parseApplyMode(value: string): ApplyMode {
  const mode = Object.values(ApplyMode).find((known) => known === value);
  if (!mode) {
    throw new Error(`Unknown mode "${value}"; use test or live`);
  }
  return mode;
}

/**
 * Builds and validates the body of `POST /api/apply/{vacancy}`.
 *
 * @param applicant - The applicant's details.
 * @param cv - The CV file; encoded as base64 with its round trip checked.
 * @param mode - Only `ApplyMode.Live` sends `test: false`.
 * @returns The validated application.
 * @throws If the CV doesn't round-trip, or any field fails validation; the
 *   error lists every failing field.
 *
 * @example
 * buildApplicationPayload(applicant, { path: "Resume.pdf", bytes }, ApplyMode.Test);
 * // { first_name: "Jane", …, cv: "JVBERi0…", cv_extension: "pdf", test: true }
 */
export function buildApplicationPayload(
  applicant: ApplicantDetails,
  cv: CvFile,
  mode: ApplyMode,
): ApplicationPayload {
  return validateApplicationPayload({
    first_name: applicant.firstName,
    last_name: applicant.lastName,
    email: applicant.email,
    telephone: applicant.telephone,
    motivation: applicant.motivation,
    cv: encodeVerified(cv.bytes),
    // The API spells extensions without the dot: "pdf", not ".pdf".
    cv_extension: extname(cv.path).slice(1).toLowerCase(),
    linkedin_url: applicant.linkedinUrl,
    github_url: applicant.githubUrl,
    // Anything other than an explicit live run stays a test call.
    test: mode !== ApplyMode.Live,
  });
}
