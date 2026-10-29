/**
 * index.ts
 *
 * The resume operations: each parses Resume.md before any request, then
 * writes it into a resume. `PUT /resumes/{id}` validates the full `data`
 * object, so every write fetches the resume's current data first.
 */

import { parseResume } from "../../../resume-md/parser.ts";
import type { RxResumeApiClient } from "../../api/client.ts";
import type {
  CreateResumeBody,
  IdFactory,
  Resume,
  ResumeData,
} from "../../api/types.ts";
import { applySectionOrder, SECTION_ORDER } from "./layout.ts";
import { applyResume } from "./mapping.ts";

/** Fetches a resume, changes its data and saves the result. */
async function patchResume(
  client: RxResumeApiClient,
  id: string,
  change: (data: ResumeData) => ResumeData,
): Promise<Resume> {
  const { data } = await client.getResume(id);
  return client.updateResume(id, { data: change(data) });
}

/**
 * Creates a resume and fills it from Resume.md, its sections on one
 * full-width page in reading order. Server defaults fill the rest.
 *
 * @param client - The Reactive Resume API client.
 * @param markdown - The full Resume.md text.
 * @param resume - The new resume's name, unused slug and tags.
 * @param newId - Ids for the items written from Resume.md.
 * @returns The saved resume.
 * @throws If Resume.md is invalid, before any request, or if a request fails.
 *
 * @example
 * await generateResume(client, markdown, { name, slug, tags }, randomUUID);
 */
export async function generateResume(
  client: RxResumeApiClient,
  markdown: string,
  resume: CreateResumeBody,
  newId: IdFactory,
): Promise<Resume> {
  const parsed = parseResume(markdown);
  // POST /resumes returns only an id, so the parsed data is written onto the
  // created resume's server defaults.
  const id = await client.createResume(resume);
  return patchResume(client, id, (created) =>
    applySectionOrder(applyResume(created, parsed, newId), SECTION_ORDER),
  );
}

/**
 * Rewrites a resume's data from Resume.md, keeping its layout, picture,
 * template and every section Resume.md doesn't feed.
 *
 * @param client - The Reactive Resume API client.
 * @param id - The resume's id, as generate prints it.
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
  const parsed = parseResume(markdown);
  return patchResume(client, id, (current) =>
    applyResume(current, parsed, newId),
  );
}

/**
 * Deletes a resume for good, with its screenshots and PDFs.
 *
 * @param client - The Reactive Resume API client.
 * @param id - The resume's id.
 * @throws If the request fails, e.g. for a locked resume.
 *
 * @example
 * await deleteResume(client, "resume-1");
 */
export function deleteResume(
  client: RxResumeApiClient,
  id: string,
): Promise<void> {
  return client.deleteResume(id);
}
