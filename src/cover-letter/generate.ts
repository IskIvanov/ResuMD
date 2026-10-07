/**
 * generate.ts
 *
 * Creates a Reactive Resume cover letter. Depends only on the client method
 * it calls, so it runs against a fake client in tests.
 */

import type { CoverLetter, CreateCoverLetterBody } from "../rx-resume/types.ts";
import type { GenerateLetterClient } from "./types.ts";

/**
 * Creates a cover letter in one request.
 *
 * Unlike `POST /resumes`, `POST /cover-letters` takes the whole letter and
 * returns it, so there's no follow-up fetch or update.
 *
 * @param client - The Reactive Resume API method it calls.
 * @param body - The new letter, from toCreateBody.
 * @returns The created letter.
 * @throws If the API rejects the request.
 *
 * @example
 * await generateCoverLetter(client, toCreateBody(parsed, options, today));
 */
export async function generateCoverLetter(
  client: GenerateLetterClient,
  body: CreateCoverLetterBody,
): Promise<CoverLetter> {
  return client.createCoverLetter(body);
}
