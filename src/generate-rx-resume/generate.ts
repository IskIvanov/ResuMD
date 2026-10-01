/**
 * generate.ts
 *
 * Creates a Reactive Resume resume and fills it with parsed Resume.md data.
 * Depends only on the client methods it calls, so it runs against a fake
 * client in tests.
 */

import { applyResumeData } from "../rx-resume/apply-data.ts";
import { applySectionOrder, SECTION_ORDER } from "../rx-resume/layout.ts";
import { patchResumeData } from "../rx-resume/patch.ts";
import type { IdFactory, Resume } from "../rx-resume/types.ts";
import type { GenerateClient, GenerateResumeInput } from "./types.ts";

/**
 * Creates an empty resume, then updates it with the parsed data.
 *
 * `POST /resumes` returns only an id, so the parsed data is patched onto the
 * created resume, whose server defaults fill everything Resume.md does not
 * feed. The sections are laid out on one full-width page, in SECTION_ORDER.
 *
 * @param client - The Reactive Resume API methods it calls.
 * @param input - The new resume's name, slug, tags and parsed data.
 * @param newId - Id factory for the new section items.
 * @returns The updated resume.
 *
 * @example
 * await generateResume(client, { name, slug, tags, data }, () => crypto.randomUUID());
 */
export async function generateResume(
  client: GenerateClient,
  input: GenerateResumeInput,
  newId: IdFactory,
): Promise<Resume> {
  const { name, slug, tags, data } = input;
  const id = await client.createResume({ name, slug, tags });
  return patchResumeData(client, id, (created) =>
    applySectionOrder(applyResumeData(created, data, newId), SECTION_ORDER),
  );
}
