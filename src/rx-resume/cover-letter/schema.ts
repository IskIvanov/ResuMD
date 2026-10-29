/**
 * schema.ts
 *
 * Zod schemas for a parsed cover-letter `.md`: the three sections it must
 * have, then the text they become. They are the source of truth for the
 * types in types.ts. Length limits are the API's, from ../rx-resume/schema.ts.
 */

import { z } from "zod";
import { CoverLetterLimit } from "../schema.ts";
import { requiredText } from "../../utils/schema.ts";

/**
 * The `.md`'s required sections, each trimmed and without `---` rules. Keyed
 * so that an error names the section, e.g. `closing: required`.
 */
export const CoverLetterSectionsSchema = z.object({
  /** `## Contact`: the hiring manager's block. */
  contact: requiredText,
  /** `## Letter`: the greeting and body. */
  letter: requiredText,
  /** `## Closing`: the sign-off. */
  closing: requiredText,
});

/** The letter's text as the API takes it: plain text, within its limits. */
export const ParsedCoverLetterSchema = z.object({
  /** From `## Contact`. */
  recipient: requiredText.max(CoverLetterLimit.RecipientMax),
  /** `## Letter`, a blank line, then `## Closing`. */
  content: requiredText.max(CoverLetterLimit.ContentMax),
});

/** Messages reported for a cover-letter id that is not accepted. */
const CoverLetterIdMessage = {
  NotUuid: "Field must accept a valid UUID",
};

/** The id Reactive Resume gives a cover letter: a UUID. */
export const CoverLetterIdSchema = z.uuid({
  message: CoverLetterIdMessage.NotUuid,
});
