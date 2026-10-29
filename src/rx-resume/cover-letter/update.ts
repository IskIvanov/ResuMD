/**
 * update.ts
 *
 * Rewrites an existing Reactive Resume cover letter without overwriting a
 * concurrent edit: the update carries the revision just read, so the API
 * rejects it if the letter changed in between.
 */

import { RxResumeError } from "../errors.ts";
import {
  type CoverLetter,
  CoverLetterLayout,
  RxResumeErrorCode,
} from "../types.ts";
import type { UpdateBodyBuilder, UpdateLetterClient } from "./types.ts";

/**
 * Reads a letter's revision, builds the body at it and saves it.
 *
 * @param client - The Reactive Resume API methods it calls.
 * @param id - The letter to update.
 * @param build - Builds the body from the letter's current revision.
 * @returns The updated letter.
 * @throws A RxResumeError, before any update is sent, if the letter isn't
 *   `freeform`: `PUT` can't change the layout, and a structured letter would
 *   print the `.md`'s greeting and sign-off next to its own. Otherwise, if
 *   either request fails; a rejected update (e.g. the letter changed since it
 *   was read, or it's locked) is passed on as the API's error, without a
 *   retry.
 *
 * @example
 * await updateCoverLetter(client, id, (revision) =>
 *   toUpdateBody(parsed, options, revision, today),
 * );
 */
export async function updateCoverLetter(
  client: UpdateLetterClient,
  id: string,
  build: UpdateBodyBuilder,
): Promise<CoverLetter> {
  const { layout, revision } = await client.getCoverLetter(id);
  if (layout !== CoverLetterLayout.Freeform) {
    throw new RxResumeError({
      code: RxResumeErrorCode.NotFreeform,
      id,
      layout,
    });
  }
  return client.updateCoverLetter(id, build(revision));
}
