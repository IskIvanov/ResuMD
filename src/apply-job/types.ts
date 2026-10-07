/**
 * types.ts
 *
 * Every type apply-job declares, in one place. The API shapes it builds
 * are inferred from the Zod schemas in ../careers-api/schema.ts.
 */

import type { ValueOf } from "../utils/type.ts";

/** Whether an application is only checked by the API, or really sent. */
export const ApplyMode = {
  /** `test: true`: the API validates and replies, but saves nothing. */
  Test: "test",
  /** `test: false`: the application goes to the recruiter. */
  Live: "live",
} as const;
export type ApplyMode = ValueOf<typeof ApplyMode>;

/** The applicant's details as typed at the CLI. */
export interface ApplicantDetails {
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
  motivation: string;
  linkedinUrl: string;
  githubUrl: string;
}

/** A CV file: its name gives `cv_extension`, its bytes become `cv`. */
export interface CvFile {
  path: string;
  bytes: Uint8Array;
}

/** Options parsed from the apply-job command line. */
export interface ApplyOptions extends ApplicantDetails {
  /** The vacancy's slug, the last part of its URL. */
  vacancy: string;
  /** Absolute path to the CV to send. */
  cv: string;
  /** As typed: `test` or `live`; checked by parseApplyMode. */
  mode: string;
}
