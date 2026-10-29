/**
 * types.ts
 *
 * The types the Reactive Resume tools and operations share: a cover letter's
 * text and the fields a tool's flags set. The text's shape is inferred from
 * the Zod schemas in schema.ts; the API shapes they build on come from
 * api/types.ts.
 */

import type { z } from "zod";
import type { UpdateCoverLetterRequest } from "./api/types.ts";
import type { CoverLetterTextSchema } from "./schema.ts";

/** A cover-letter `.md`'s text, as the API takes it. */
export type CoverLetterText = z.infer<typeof CoverLetterTextSchema>;

/**
 * The letter fields a tool's flags set, named as the API names them: its
 * name, source resume, job application, recipient's company and template. A
 * field left undefined isn't sent.
 */
export type LetterFields = Pick<
  UpdateCoverLetterRequest,
  "name" | "resumeId" | "applicationId" | "recipientCompany" | "template"
>;

/** A new letter's fields: it needs a name and a source resume. */
export type NewLetterFields = LetterFields & { name: string; resumeId: string };

export enum ResumeFormat {
  Pdf = "pdf",
  Docx = "docx",
  Json = "json",
  OpenDocument = "odt",
  Markdown = "md",
}
