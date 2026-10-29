/**
 * operations.ts
 *
 * The cover-letter operations: each parses the `.md` and checks the body
 * against the API's rules before any request, then writes the letter.
 */

import { resolveLetterDashboardUrl } from "../config.ts";
import type {
  CoverLetter,
  CoverLetterOperations,
  CoverLetterResult,
  RxResumeClient,
} from "../types.ts";
import { toCreateBody, toUpdateBody } from "./body.ts";
import { deleteCoverLetter } from "./delete.ts";
import { parseCoverLetter } from "./parser.ts";
import { updateCoverLetter } from "./update.ts";

/**
 * Builds the cover-letter operations on a connected client.
 *
 * @param client - The Reactive Resume API client.
 * @param appUrl - URL of the web app, for the dashboard links.
 * @param today - Today's date as `YYYY-MM-DD`, the date each letter is written.
 * @returns generate, update and delete.
 *
 * @example
 * coverLetterOperations(client, appUrl, today).delete(id);
 */
export function coverLetterOperations(
  client: RxResumeClient,
  appUrl: string,
  today: () => string,
): CoverLetterOperations {
  function toResult({ id, name, revision }: CoverLetter): CoverLetterResult {
    return {
      id,
      name,
      revision,
      dashboardUrl: resolveLetterDashboardUrl(appUrl, id),
    };
  }

  return {
    generate: async ({ markdown, ...fields }) => {
      const body = toCreateBody(parseCoverLetter(markdown), fields, today());
      return toResult(await client.createCoverLetter(body));
    },
    update: async ({ id, markdown, ...fields }) => {
      const parsed = parseCoverLetter(markdown);
      const date = today();
      const letter = await updateCoverLetter(client, id, (revision) =>
        toUpdateBody(parsed, fields, revision, date),
      );
      return toResult(letter);
    },
    delete: (id) => deleteCoverLetter(client, id),
  };
}
