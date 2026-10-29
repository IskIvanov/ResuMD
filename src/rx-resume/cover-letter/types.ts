/**
 * types.ts
 *
 * The types the cover-letter files share, and the headings of their errors.
 * The parsed shapes are inferred from the Zod schemas in schema.ts; the API
 * shapes they build on come from ../types.ts.
 */

import type { z } from "zod";
import type {
  CoverLetter,
  RxResumeClient,
  UpdateCoverLetterBody,
} from "../types.ts";
import type { ParsedCoverLetterSchema } from "./schema.ts";

/** The first line of a validation error. */
export enum CoverLetterLabel {
  InvalidLetter = "Invalid cover letter:",
  InvalidRequest = "Invalid cover letter request:",
}

// ─── Parsed `.md` ─────────────────────────────────────────────────────────────

export type ParsedCoverLetter = z.infer<typeof ParsedCoverLetterSchema>;

/** The fields a create and an update share. */
export type LetterFields = Omit<UpdateCoverLetterBody, "expectedRevision">;

// ─── Flows ────────────────────────────────────────────────────────────────────

/** The client methods updateCoverLetter calls. */
export type UpdateLetterClient = Pick<
  RxResumeClient,
  "getCoverLetter" | "updateCoverLetter"
>;

/** The client methods deleteCoverLetter calls. */
export type DeleteLetterClient = Pick<
  RxResumeClient,
  "getCoverLetter" | "trashCoverLetter" | "removeCoverLetter"
>;

/** Builds the update body once the letter's current revision is known. */
export type UpdateBodyBuilder = (
  revision: CoverLetter["revision"],
) => UpdateCoverLetterBody;
