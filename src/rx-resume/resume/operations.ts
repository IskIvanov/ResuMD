/**
 * operations.ts
 *
 * The resume operations: each parses Resume.md before any request, then
 * writes it into a resume. `PUT /resumes/{id}` validates the full `data`
 * object, so every write fetches the resume's current data first.
 */

import { parseResume } from "../../sync-resume/parser.ts";
import { resolveBuilderUrl } from "../config.ts";
import type {
  IdFactory,
  Resume,
  ResumeData,
  ResumeOperations,
  ResumeResult,
  RxResumeClient,
} from "../types.ts";
import { applySectionOrder, SECTION_ORDER } from "./layout.ts";
import { applyResume } from "./mapping.ts";

/**
 * Builds the resume operations on a connected client.
 *
 * @param client - The Reactive Resume API client.
 * @param appUrl - URL of the web app, for the builder links.
 * @param newId - Ids for the items written from Resume.md.
 * @returns generate, update and delete.
 *
 * @example
 * resumeOperations(client, appUrl, randomUUID).update({ id, markdown });
 */
export function resumeOperations(
  client: RxResumeClient,
  appUrl: string,
  newId: IdFactory,
): ResumeOperations {
  /** Fetches a resume, changes its data and saves the result. */
  async function patch(
    id: string,
    change: (data: ResumeData) => ResumeData,
  ): Promise<ResumeResult> {
    const { data } = await client.getResume(id);
    return toResult(await client.updateResume(id, { data: change(data) }));
  }

  function toResult({ id, name, slug }: Resume): ResumeResult {
    return { id, name, slug, builderUrl: resolveBuilderUrl(appUrl, id) };
  }

  return {
    // POST /resumes returns only an id, so the parsed data is written onto
    // the created resume's server defaults.
    generate: async ({ markdown, name, slug, tags }) => {
      const parsed = parseResume(markdown);
      const id = await client.createResume({ name, slug, tags });
      return patch(id, (created) =>
        applySectionOrder(applyResume(created, parsed, newId), SECTION_ORDER),
      );
    },
    update: async ({ id, markdown }) => {
      const parsed = parseResume(markdown);
      return patch(id, (current) => applyResume(current, parsed, newId));
    },
    delete: (id) => client.deleteResume(id),
  };
}
