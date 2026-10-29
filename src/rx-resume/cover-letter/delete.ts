/**
 * delete.ts
 *
 * Permanently deletes a Reactive Resume cover letter. The API only removes a
 * letter that's already in Trash, so it's moved there first.
 */

import { RxResumeError } from "../errors.ts";
import { RxResumeErrorCode } from "../types.ts";
import type { DeleteLetterClient } from "./types.ts";

/**
 * Reads a letter's revision, moves it to Trash, then purges it.
 *
 * @param client - The Reactive Resume API methods it calls.
 * @param id - The letter to delete.
 * @throws If a request fails. When only the purge fails, a RxResumeError
 *   says the letter is in Trash, where it can still be restored; it isn't
 *   rolled back.
 *
 * @example
 * await deleteCoverLetter(client, "clx…");
 */
export async function deleteCoverLetter(
  client: DeleteLetterClient,
  id: string,
): Promise<void> {
  const { revision } = await client.getCoverLetter(id);
  await client.trashCoverLetter(id, revision);
  try {
    await client.removeCoverLetter(id);
  } catch (error) {
    const failure = error instanceof Error ? error.message : String(error);
    throw new RxResumeError(
      { code: RxResumeErrorCode.LeftInTrash, id, failure },
      { cause: error },
    );
  }
}
