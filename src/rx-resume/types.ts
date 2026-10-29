/**
 * types.ts
 *
 * The types the Reactive Resume tools and operations share: a parsed
 * cover-letter `.md` and a letter's metadata.
 * The parsed shape is inferred from the Zod schemas in schema.ts; the API
 * shapes they build on come from api/types.ts.
 */

import type { z } from "zod";
import type { UpdateCoverLetterBody } from "./api/types.ts";
import type { ParsedCoverLetterSchema } from "./schema.ts";

export type ParsedCoverLetter = z.infer<typeof ParsedCoverLetterSchema>;

/**
 * A letter's metadata, named as the API names it. A field left undefined
 * isn't sent.
 */
export type LetterFields = Pick<
  UpdateCoverLetterBody,
  "name" | "resumeId" | "applicationId" | "recipientCompany" | "template"
>;

/** A new letter's metadata: it needs a name and the resume it goes with. */
export type NewLetterFields = LetterFields & { name: string; resumeId: string };
