/**
 * patch.ts
 *
 * The fetch → change → save round trip shared by every tool that writes a
 * resume's data. `PUT /resumes/{id}` validates the full `data` object, so the
 * change is always applied to the resume's current data.
 */

import type { PatchClient, Resume, ResumeDataPatch } from "./types.ts";

/**
 * Fetches a resume, applies a patch to its data and saves the result.
 *
 * @param client - The Reactive Resume API methods it calls.
 * @param id - The resume to change.
 * @param patch - Builds the data to save from the current data.
 * @returns The updated resume.
 * @throws If the API rejects either request; nothing is saved when the fetch
 *   fails.
 *
 * @example
 * await patchResumeData(client, id, (data) => applyResumeData(data, parsed, randomUUID));
 */
export async function patchResumeData(
  client: PatchClient,
  id: string,
  patch: ResumeDataPatch,
): Promise<Resume> {
  const { data } = await client.getResume(id);
  return client.updateResume(id, { data: patch(data) });
}
