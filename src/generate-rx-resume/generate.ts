/**
 * generate.ts
 *
 * Creates a Reactive Resume resume and fills it with parsed Resume.md data.
 * Depends only on the RxResumeClient interface, so it runs against a fake
 * client in tests.
 */

import { applyResumeData, type IdFactory } from "../rx-resume/apply-data.ts";
import type { RxResumeClient } from "../rx-resume/client.ts";
import { applySectionOrder, SECTION_ORDER } from "../rx-resume/layout.ts";
import type {
  CreateResumeBody,
  ParsedResumeData,
  Resume,
} from "../rx-resume/types.ts";

export interface GenerateResumeInput extends Omit<
  CreateResumeBody,
  "withSampleData"
> {
  data: ParsedResumeData;
}

/**
 * Creates an empty resume, then updates it with the parsed data.
 *
 * `POST /resumes` returns only an id and `PUT /resumes/{id}` validates the
 * full `data` object, so the created resume is fetched first to supply the
 * server's defaults for everything Resume.md does not feed. The sections are
 * laid out on one full-width page, in SECTION_ORDER.
 *
 * @param client - A Reactive Resume API client.
 * @param input - The new resume's name, slug, tags and parsed data.
 * @param newId - Id factory for the new section items.
 * @returns The updated resume.
 *
 * @example
 * await generateResume(client, { name, slug, tags, data }, () => crypto.randomUUID());
 */
export async function generateResume(
  client: RxResumeClient,
  input: GenerateResumeInput,
  newId: IdFactory,
): Promise<Resume> {
  const { name, slug, tags, data } = input;
  const id = await client.createResume({ name, slug, tags });
  const created = await client.getResume(id);
  const filled = applyResumeData(created.data, data, newId);
  return client.updateResume(id, {
    data: applySectionOrder(filled, SECTION_ORDER),
  });
}
