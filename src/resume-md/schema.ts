/**
 * schema.ts
 *
 * Zod schemas for what Resume.md says, as the parser reads it. They are the
 * source of truth for the types in types.ts, which are inferred from them,
 * and validateResumeMd checks the parser's result against them at runtime.
 */

import { z } from "zod";
import { parseOrThrow, requiredText, FieldProblem } from "../utils/schema.ts";
import type { ResumeMd } from "./types.ts";

const ERROR_HEADING = "Invalid Resume.md:";
/** Most references a job may list. */
const MAX_REFERENCES = 2;
const TOO_MANY_REFERENCES = `at most ${MAX_REFERENCES} entries`;

// ─── What Resume.md says ──────────────────────────────────────────────────────

/** A markdown link: `[label](url)`. */
export const LinkSchema = z.object({
  label: z.string(),
  url: z.string(),
});

/** The header above the first `## ` section: name, headline and contact line. */
export const HeaderSchema = z.object({
  name: z.string(),
  headline: z.string(),
  email: z.email(FieldProblem.InvalidEmail),
  phone: z.string().regex(/^\+?[0-9\s\-()]*$/, "invalid phone number format"),
  location: z.string(),
  /** As written in Resume.md, with or without a protocol. */
  website: z.string(),
  /** Markdown links in the header, e.g. `[GitHub](https://github.com/me)`. */
  profiles: z.array(LinkSchema),
});

export const JobSchema = z.object({
  company: requiredText,
  location: z.string(),
  role: requiredText,
  period: requiredText,
  intro: z.string(),
  bullets: z.array(z.string()),
  techStack: requiredText,
  /** Company URL from a bare `https://…` line, or an empty string. */
  website: z.string(),
  /** Reference emails from a `**Reference:** a, b` line; absent without one. */
  references: z
    .array(z.email(FieldProblem.InvalidEmail))
    .min(1, FieldProblem.Empty)
    .max(MAX_REFERENCES, TOO_MANY_REFERENCES)
    .refine(
      (references) => new Set(references).size === references.length,
      FieldProblem.Duplicate,
    )
    .optional(),
});

export const SkillGroupSchema = z.object({
  /** The bold label, without its colon. */
  label: requiredText,
  skills: z.array(z.string()).min(1, FieldProblem.Empty),
});

export const SchoolSchema = z.object({
  school: requiredText,
  location: z.string(),
  degree: requiredText,
  area: z.string(),
  grade: z.string(),
  period: requiredText,
  intro: z.string(),
  bullets: z.array(z.string()),
});

export const ProjectSchema = z.object({
  title: z.string(),
  intro: z.string(),
  techStack: z.string(),
  /** Markdown links in the project block, in document order. */
  links: z.array(LinkSchema),
});

export const CertificationSchema = z.object({
  title: requiredText,
  issuer: requiredText,
  description: z.string(),
  credentialIds: z.array(z.string()),
  /** The first markdown link in the entry; absent without one. */
  link: LinkSchema.optional(),
});

export const LanguageSchema = z.object({
  language: z.string(),
  fluency: z.string(),
  /** 0–5; 0 when the bullet gives no level. */
  level: z.number(),
});

/**
 * Everything Resume.md says. A summary and at least one job, skill group and
 * school are required; the remaining sections may be empty.
 */
export const ResumeMdSchema = z.object({
  header: HeaderSchema,
  summary: requiredText,
  jobs: z.array(JobSchema).min(1, FieldProblem.Empty),
  skillGroups: z.array(SkillGroupSchema).min(1, FieldProblem.Empty),
  schools: z.array(SchoolSchema).min(1, FieldProblem.Empty),
  projects: z.array(ProjectSchema),
  certifications: z.array(CertificationSchema),
  languages: z.array(LanguageSchema),
  interests: z.array(z.string()),
  references: z.array(z.string()),
});

/**
 * Checks what the parser read against ResumeMdSchema.
 *
 * @param resumeMd - The object assembled by the section readers.
 * @returns The same data, typed as a ResumeMd.
 * @throws If required content is missing; the error lists every failure with
 *   its path, e.g. `jobs[2].role: required`.
 *
 * @example
 * validateResumeMd({ ...resumeMd, jobs: [] });
 * // Error: Invalid Resume.md:
 * //   jobs: needs at least one entry
 */
export function validateResumeMd(resumeMd: unknown): ResumeMd {
  return parseOrThrow(ResumeMdSchema, resumeMd, ERROR_HEADING);
}
