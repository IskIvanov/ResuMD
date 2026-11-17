/**
 * schema.ts
 *
 * Zod schemas for what the tools read: a cover-letter id, and a cover-letter
 * `.md` (the three sections it must have, then the text they become). They
 * are the source of truth for the types in types.ts. Length limits are the
 * API's, from api/schema.ts.
 */

import { z } from "zod";
import { CoverLetterLimit } from "./api/schema.ts";
import { requiredText } from "../utils/schema.ts";

/**
 * The `.md`'s required sections, each trimmed and without `---` rules. Keyed
 * by heading, so that an error names the section, e.g. `signOff: required`.
 */
export const CoverLetterSectionsSchema = z.object({
  /** `## Recipient`: the recipient block. */
  recipient: requiredText,
  /** `## Letter`: the body, from the greeting to its last paragraph. */
  letter: requiredText,
  /** `## Sign-off`: the closing words and the signature. */
  signOff: requiredText,
});

/** The letter's text as the API takes it: plain text, within its limits. */
export const CoverLetterTextSchema = z.object({
  /** The recipient block. */
  recipient: requiredText.max(CoverLetterLimit.RecipientMax),
  /** The body, a blank line, then the sign-off. */
  content: requiredText.max(CoverLetterLimit.ContentMax),
});

/** The address of a Reactive Resume instance: an http or https URL. */
export const AddressSchema = z.url({
  protocol: /^https?$/,
  message: "must start with http:// or https://, e.g. https://rxresu.me",
});

/** What's wrong with a cover-letter id that isn't accepted. */
const CoverLetterIdProblem = {
  NotUuid: "Field must accept a valid UUID",
};

/** The id Reactive Resume gives a cover letter: a UUID. */
export const CoverLetterIdSchema = z.uuid({
  message: CoverLetterIdProblem.NotUuid,
});
