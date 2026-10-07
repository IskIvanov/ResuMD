/**
 * types.ts
 *
 * Every type cover-letter declares, in one place, and its UI strings. The
 * parsed shapes are inferred from the Zod schemas in schema.ts; the API
 * shapes they build on come from ../rx-resume/types.ts.
 */

import type { z } from "zod";
import type {
  CoverLetter,
  CoverLetterLayout,
  RxResumeClient,
  UpdateCoverLetterBody,
} from "../rx-resume/types.ts";
import type {
  CoverLetterSectionsSchema,
  ParsedCoverLetterSchema,
} from "./schema.ts";

/** Every string the cover-letter tools print. */
export enum CoverLetterLabel {
  Created = "✓ Created cover letter",
  Updated = "✓ Updated cover letter",
  Deleted = "✓ Permanently deleted cover letter",
  LetterLink = "  letter:",
  InTrash = "is in Trash",
  Letter = "letter",
  InvalidLetter = "Invalid cover letter:",
  InvalidRequest = "Invalid cover letter request:",
  CoverLetter = "Cover letter",
  IsLaidOut = "is laid out",
  OnlyFreeform = "only a freeform letter can be updated, since the .md writes its own greeting and sign-off",
}

/** Why a cover-letter flow stopped; each code's details are in CoverLetterErrorReason. */
export enum CoverLetterErrorCode {
  /** The letter's layout isn't freeform, so the `.md` would print twice. */
  NotFreeform = "NOT_FREEFORM",
  /** The letter was moved to Trash, but purging it failed. */
  LeftInTrash = "LEFT_IN_TRASH",
}

/** A CoverLetterError's code with what its message needs, one shape per code. */
export type CoverLetterErrorReason =
  | {
      code: CoverLetterErrorCode.NotFreeform;
      id: string;
      layout: CoverLetterLayout;
    }
  | {
      code: CoverLetterErrorCode.LeftInTrash;
      id: string;
      /** Why the purge failed. */
      failure: string;
    };

// ─── Parsed `.md` ─────────────────────────────────────────────────────────────

export type CoverLetterSections = z.infer<typeof CoverLetterSectionsSchema>;
export type ParsedCoverLetter = z.infer<typeof ParsedCoverLetterSchema>;

// ─── Options ──────────────────────────────────────────────────────────────────

/**
 * The letter's metadata from CLI flags. A field left undefined isn't sent.
 * Each is typed by the API field it's sent as, so retyping that field breaks
 * the build here rather than the request.
 */
export interface CoverLetterFields {
  name?: UpdateCoverLetterBody["name"];
  /** The resume that gives the letter its sender details and design. */
  resumeId?: UpdateCoverLetterBody["resumeId"];
  /** The job application the letter is for. */
  applicationId?: UpdateCoverLetterBody["applicationId"];
  /** Sent as `recipientCompany`. */
  company?: UpdateCoverLetterBody["recipientCompany"];
  /** Unlinks the resume's design when set. */
  template?: UpdateCoverLetterBody["template"];
}

/** A new letter's metadata: it needs a name and the resume it goes with. */
export interface NewCoverLetterFields extends CoverLetterFields {
  name: string;
  resumeId: string;
}

/** Options parsed from the generate-cover-letter command line. */
export interface GenerateCoverLetterOptions extends NewCoverLetterFields {
  /** Absolute path to the cover-letter `.md`. */
  letter: string;
}

/** Options parsed from the update-cover-letter command line. */
export interface UpdateCoverLetterOptions extends CoverLetterFields {
  /** Id of the letter to update, as generate-cover-letter prints. */
  id: string;
  /** Absolute path to the cover-letter `.md`. */
  letter: string;
}

/** Options parsed from the delete-cover-letter command line. */
export interface DeleteCoverLetterOptions {
  /** Id of the letter to delete. */
  id: string;
}

// ─── Flows ────────────────────────────────────────────────────────────────────

/** The client methods generateCoverLetter calls. */
export type GenerateLetterClient = Pick<RxResumeClient, "createCoverLetter">;

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
