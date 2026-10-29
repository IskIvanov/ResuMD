/**
 * index.ts
 *
 * The cover-letter operations: each parses the `.md` and checks the request
 * against the API's rules, then writes the letter. Every letter is freeform,
 * since the `.md` writes its own greeting and sign-off.
 */

import { omitUndefined } from "../../../utils/record.ts";
import { parseOrThrow } from "../../../utils/schema.ts";
import type { RxResumeApiClient } from "../../api/client.ts";
import {
  CreateCoverLetterRequestSchema,
  UpdateCoverLetterRequestSchema,
} from "../../api/schema.ts";
import { type CoverLetter, CoverLetterLayout } from "../../api/types.ts";
import type { LetterFields, NewLetterFields } from "../../types.ts";
import { parseCoverLetter } from "./parser.ts";

/** Heads the error for a request the API would reject. */
const INVALID_REQUEST = "Invalid cover letter request:";

/**
 * Creates a freeform letter from its `.md`, dated today.
 *
 * @param client - The Reactive Resume API client.
 * @param markdown - The full cover-letter `.md` text.
 * @param fields - The new letter's name, source resume id and optional
 *   fields.
 * @param today - The letter's date, as `YYYY-MM-DD`.
 * @returns The created letter.
 * @throws If the `.md` is missing a section or a field breaks the API's
 *   rules (e.g. a name over 100 characters), before any request; or if the
 *   request fails.
 *
 * @example
 * await createCoverLetter(client, markdown, { name, resumeId }, "2026-10-06");
 */
export async function createCoverLetter(
  client: RxResumeApiClient,
  markdown: string,
  fields: NewLetterFields,
  today: string,
): Promise<CoverLetter> {
  const newLetter = parseOrThrow(
    CreateCoverLetterRequestSchema,
    omitUndefined({
      ...fields,
      ...parseCoverLetter(markdown),
      layout: CoverLetterLayout.Freeform,
      letterDate: today,
    }),
    INVALID_REQUEST,
  );
  return client.createCoverLetter(newLetter);
}

/**
 * Rewrites a freeform letter from its `.md` at the revision just read, dated
 * today, so a concurrent edit isn't overwritten.
 *
 * @param client - The Reactive Resume API client.
 * @param id - The letter's id, as create prints it.
 * @param markdown - The full cover-letter `.md` text.
 * @param fields - The fields to change; a field left out keeps its value.
 * @param today - The letter's date, as `YYYY-MM-DD`.
 * @returns The updated letter.
 * @throws If the `.md` is invalid, before any request; before any update is
 *   sent, if the letter isn't `freeform`: `PUT` can't
 *   change the layout, and a structured letter would print the `.md`'s
 *   greeting and sign-off next to its own. Otherwise, if a request fails; a
 *   rejected update (e.g. the letter changed since it was read, or it's
 *   locked) is passed on as the API's error, without a retry.
 *
 * @example
 * await updateCoverLetter(client, id, markdown, {}, "2026-10-06");
 */
export async function updateCoverLetter(
  client: RxResumeApiClient,
  id: string,
  markdown: string,
  fields: LetterFields,
  today: string,
): Promise<CoverLetter> {
  const letterText = parseCoverLetter(markdown);
  const { layout, revision } = await client.getCoverLetter(id);
  if (layout !== CoverLetterLayout.Freeform) {
    throw new Error(
      `Cover letter ${id} is laid out "${layout}"; only a freeform letter ` +
        "can be updated, since the .md writes its own greeting and sign-off",
    );
  }
  const changes = parseOrThrow(
    UpdateCoverLetterRequestSchema,
    omitUndefined({
      ...fields,
      ...letterText,
      letterDate: today,
      expectedRevision: revision,
    }),
    INVALID_REQUEST,
  );
  return client.updateCoverLetter(id, changes);
}

/**
 * Deletes a letter for good. The API only purges a letter that's already in
 * Trash, so it's moved there first, at the revision just read.
 *
 * @param client - The Reactive Resume API client.
 * @param id - The letter's id.
 * @throws If a request fails. When only the purge fails, the error says the
 *   letter is in Trash, where it can still be restored; it isn't
 *   rolled back.
 *
 * @example
 * await deleteCoverLetter(client, id);
 */
export async function deleteCoverLetter(
  client: RxResumeApiClient,
  id: string,
): Promise<void> {
  const { revision } = await client.getCoverLetter(id);
  await client.trashCoverLetter(id, revision);
  try {
    await client.purgeCoverLetter(id);
  } catch (error) {
    let failure = String(error);
    if (error instanceof Error) failure = error.message;
    throw new Error(`${failure}; letter ${id} is in Trash`, { cause: error });
  }
}
