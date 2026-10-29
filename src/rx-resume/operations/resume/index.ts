/**
 * index.ts
 *
 * The resume operations: each parses Resume.md before any request, then
 * writes it into a resume. `PUT /resumes/{id}` validates the full `data`
 * object, so every write fetches the resume's current data first.
 */

import { parseResumeMd } from "../../../resume-md/parser.ts";
import type { RxResumeApiClient } from "../../api/client.ts";
import type {
  CreateResumeRequest,
  IdFactory,
  Resume,
  ResumeData,
} from "../../api/types.ts";
import { applySectionOrder, SECTION_ORDER } from "./layout.ts";
import { applyResumeMd } from "./mapping.ts";

/** Fetches a resume, rewrites its data and saves the result. */
async function rewriteResumeData(
  client: RxResumeApiClient,
  id: string,
  rewrite: (currentData: ResumeData) => ResumeData,
): Promise<Resume> {
  const { data } = await client.getResume(id);
  return client.updateResume(id, { data: rewrite(data) });
}

/**
 * Creates a resume and fills it from Resume.md, its sections on one
 * full-width page in reading order. Server defaults fill the rest.
 *
 * @param client - The Reactive Resume API client.
 * @param markdown - The full Resume.md text.
 * @param newResume - The new resume's name, unused slug and tags.
 * @param newId - Ids for the items written from Resume.md.
 * @returns The saved resume.
 * @throws If Resume.md is invalid, before any request, or if a request fails.
 *
 * @example
 * await createResume(client, markdown, { name, slug, tags }, randomUUID);
 */
export async function createResume(
  client: RxResumeApiClient,
  markdown: string,
  newResume: CreateResumeRequest,
  newId: IdFactory,
): Promise<Resume> {
  const resumeMd = parseResumeMd(markdown);
  // POST /resumes returns only an id, so Resume.md is written onto the
  // created resume's server defaults.
  const id = await client.createResume(newResume);
  return rewriteResumeData(client, id, (defaultData) =>
    applySectionOrder(
      applyResumeMd(defaultData, resumeMd, newId),
      SECTION_ORDER,
    ),
  );
}

/**
 * Rewrites a resume's data from Resume.md, keeping its layout, picture,
 * template and every section Resume.md doesn't feed.
 *
 * @param client - The Reactive Resume API client.
 * @param id - The resume's id, as create prints it.
 * @param markdown - The full Resume.md text.
 * @param newId - Ids for the items written from Resume.md.
 * @returns The saved resume.
 * @throws If Resume.md is invalid, before any request, or if a request fails.
 *
 * @example
 * await updateResume(client, "resume-1", markdown, randomUUID);
 */
export async function updateResume(
  client: RxResumeApiClient,
  id: string,
  markdown: string,
  newId: IdFactory,
): Promise<Resume> {
  const resumeMd = parseResumeMd(markdown);
  return rewriteResumeData(client, id, (currentData) =>
    applyResumeMd(currentData, resumeMd, newId),
  );
}

/**
 * Deletes a resume for good, with its screenshots and PDFs. The API only
 * purges a resume that's already in Trash, so it's moved there first.
 *
 * @param client - The Reactive Resume API client.
 * @param id - The resume's id.
 * @throws If a request fails, e.g. for a locked resume. When only the purge
 *   fails, the error says the resume is in Trash, where it can still be
 *   restored; it isn't rolled back.
 *
 * @example
 * await deleteResume(client, "resume-1");
 */
export async function deleteResume(
  client: RxResumeApiClient,
  id: string,
): Promise<void> {
  await client.trashResume(id);
  try {
    await client.purgeResume(id);
  } catch (error) {
    let failure = String(error);
    if (error instanceof Error) failure = error.message;
    throw new Error(`${failure}; resume ${id} is in Trash`, { cause: error });
  }
}
