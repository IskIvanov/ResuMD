/**
 * schema.ts
 *
 * Zod schemas for the parser's output. They are the source of truth for the
 * types in types.ts, which are inferred from them, and validateParsedResume
 * checks the parser's output against them at runtime.
 */

import { z } from "zod";
import {
  parseOrThrow,
  requiredText,
  ValidationMessage,
} from "../utils/schema.ts";
import type { ParsedResume } from "./types.ts";

const ERROR_HEADING = "Invalid Resume.md:";
/** Most references a job may list. */
const MAX_REFERENCES = 2;
const TOO_MANY_REFERENCES = `at most ${MAX_REFERENCES} entries`;

// ─── Parsed Resume.md ─────────────────────────────────────────────────────────

/** A markdown link: `[label](url)`. */
export const ParsedLinkSchema = z.object({
  label: z.string(),
  url: z.string(),
});

/** Personal details from the header above the first `## ` section. */
export const ParsedContactSchema = z.object({
  name: z.string(),
  headline: z.string(),
  email: z.email(ValidationMessage.InvalidEmail),
  phone: z.string().regex(/^\+?[0-9\s\-()]*$/, "invalid phone number format"),
  location: z.string(),
  /** As written in Resume.md, with or without a protocol. */
  website: z.string(),
  /** Markdown links in the header, e.g. `[GitHub](https://github.com/me)`. */
  profiles: z.array(ParsedLinkSchema),
});

export const ParsedJobSchema = z.object({
  company: requiredText,
  location: z.string(),
  role: requiredText,
  period: requiredText,
  context: z.string(),
  bullets: z.array(z.string()),
  stack: requiredText,
  /** Company URL from a bare `https://…` line, or an empty string. */
  website: z.string(),
  /** Reference emails from a `**Reference:** a, b` line; absent without one. */
  references: z
    .array(z.email(ValidationMessage.InvalidEmail))
    .min(1, ValidationMessage.Empty)
    .max(MAX_REFERENCES, TOO_MANY_REFERENCES)
    .refine(
      (references) => new Set(references).size === references.length,
      ValidationMessage.Duplicate,
    )
    .optional(),
});

export const ParsedSkillGroupSchema = z.object({
  heading: requiredText,
  items: z.array(z.string()).min(1, ValidationMessage.Empty),
});

export const ParsedEduItemSchema = z.object({
  school: requiredText,
  location: z.string(),
  degree: requiredText,
  area: z.string(),
  grade: z.string(),
  period: requiredText,
  context: z.string(),
  bullets: z.array(z.string()),
});

export const ParsedProjectSchema = z.object({
  title: z.string(),
  context: z.string(),
  stack: z.string(),
  /** Markdown links in the project block, in document order. */
  links: z.array(ParsedLinkSchema),
});

export const ParsedCertificationSchema = z.object({
  title: requiredText,
  issuer: requiredText,
  description: z.string(),
  credentialIds: z.array(z.string()),
  /** The first markdown link in the entry; absent without one. */
  link: ParsedLinkSchema.optional(),
});

export const ParsedLanguageSchema = z.object({
  language: z.string(),
  fluency: z.string(),
  /** 0–5; 0 when the bullet gives no level. */
  level: z.number(),
});

/**
 * The full parser output. A summary and at least one job, skill group and
 * education item are required; the remaining sections may be empty.
 */
export const ParsedResumeSchema = z.object({
  contact: ParsedContactSchema,
  summary: requiredText,
  jobs: z.array(ParsedJobSchema).min(1, ValidationMessage.Empty),
  skillGroups: z.array(ParsedSkillGroupSchema).min(1, ValidationMessage.Empty),
  eduItems: z.array(ParsedEduItemSchema).min(1, ValidationMessage.Empty),
  projects: z.array(ParsedProjectSchema),
  certifications: z.array(ParsedCertificationSchema),
  languages: z.array(ParsedLanguageSchema),
  interests: z.array(z.string()),
  references: z.array(z.string()),
});

/**
 * Checks parser output against ParsedResumeSchema.
 *
 * @param resume - The object assembled by the section parsers.
 * @returns The same data, typed as a ParsedResume.
 * @throws If required content is missing; the error lists every failure with
 *   its path, e.g. `jobs[2].role: required`.
 *
 * @example
 * validateParsedResume({ ...resume, jobs: [] });
 * // Error: Invalid Resume.md:
 * //   jobs: needs at least one entry
 */
export function validateParsedResume(resume: unknown): ParsedResume {
  return parseOrThrow(ParsedResumeSchema, resume, ERROR_HEADING);
}
