/**
 * body.ts
 *
 * Builds the `POST` and `PUT /cover-letters` bodies from a parsed letter and
 * the CLI flags. Each body is checked against the API's schema, so a value
 * the API would reject fails here, before a write is sent.
 */

import {
  CreateCoverLetterBodySchema,
  UpdateCoverLetterBodySchema,
} from "../rx-resume/schema.ts";
import {
  CoverLetterLayout,
  type CreateCoverLetterBody,
  type UpdateCoverLetterBody,
} from "../rx-resume/types.ts";
import { omitUndefined } from "../utils/record.ts";
import { parseOrThrow } from "../utils/schema.ts";
import {
  CoverLetterLabel,
  type CoverLetterFields,
  type NewCoverLetterFields,
  type ParsedCoverLetter,
} from "./types.ts";

/** The fields a create and an update share. */
type LetterFields = Omit<UpdateCoverLetterBody, "expectedRevision">;

/**
 * The text, the flags as API fields and today's date. The `.md` always sets
 * the recipient, even when the letter is linked to an application.
 */
function toLetterFields(
  parsed: ParsedCoverLetter,
  options: CoverLetterFields,
  today: string,
): LetterFields {
  return {
    name: options.name,
    recipient: parsed.recipient,
    content: parsed.content,
    resumeId: options.resumeId,
    applicationId: options.applicationId,
    recipientCompany: options.company,
    template: options.template,
    letterDate: today,
  };
}

/**
 * Builds the body of `POST /cover-letters`.
 *
 * @param parsed - The letter's text, from parseCoverLetter.
 * @param options - The new letter's name, resume id and optional flags.
 * @param today - The letter's date, as `YYYY-MM-DD`.
 * @returns The body, always `freeform`, since the `.md` writes its own
 *   greeting and sign-off. Flags that weren't given are left out.
 * @throws If a field breaks the API's rules, e.g. a name over 100 characters.
 *
 * @example
 * toCreateBody(parsed, { name: "Acme", resumeId: "r1" }, "2026-10-06");
 * // { name: "Acme", resumeId: "r1", recipient, content, layout: "freeform", letterDate: "2026-10-06" }
 */
export function toCreateBody(
  parsed: ParsedCoverLetter,
  options: NewCoverLetterFields,
  today: string,
): CreateCoverLetterBody {
  const body: CreateCoverLetterBody = {
    ...toLetterFields(parsed, options, today),
    name: options.name,
    layout: CoverLetterLayout.Freeform,
  };
  return parseOrThrow(
    CreateCoverLetterBodySchema,
    omitUndefined(body),
    CoverLetterLabel.InvalidRequest,
  );
}

/**
 * Builds the body of `PUT /cover-letters/{id}`.
 *
 * @param parsed - The letter's text, from parseCoverLetter.
 * @param options - The optional flags; one not given keeps the stored value.
 * @param revision - The letter's revision when it was read; the API rejects
 *   the update if it has changed since.
 * @param today - The letter's date, as `YYYY-MM-DD`.
 * @returns The body, without a layout, which the API can't change.
 * @throws If a field breaks the API's rules, e.g. a name over 100 characters.
 *
 * @example
 * toUpdateBody(parsed, {}, 3, "2026-10-06");
 * // { expectedRevision: 3, recipient, content, letterDate: "2026-10-06" }
 */
export function toUpdateBody(
  parsed: ParsedCoverLetter,
  options: CoverLetterFields,
  revision: number,
  today: string,
): UpdateCoverLetterBody {
  const body: UpdateCoverLetterBody = {
    ...toLetterFields(parsed, options, today),
    expectedRevision: revision,
  };
  return parseOrThrow(
    UpdateCoverLetterBodySchema,
    omitUndefined(body),
    CoverLetterLabel.InvalidRequest,
  );
}
