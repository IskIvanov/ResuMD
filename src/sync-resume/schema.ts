/**
 * schema.ts
 *
 * Zod schemas for the data sync-resume reads and writes: the parser's output,
 * the site CV frontmatter and the RxResume JSON. They are the source of truth
 * for the types in types.ts, which are inferred from them.
 *
 * Only the parser's output is validated at runtime (see validateParsedResume);
 * the CV and RxResume JSON schemas describe shapes that are trusted on read.
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
  title: z.string(),
  issuer: z.string(),
  credentialIds: z.array(z.string()),
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

// ─── Site CV frontmatter ──────────────────────────────────────────────────────

export const ContactItemSchema = z.object({
  label: z.string(),
  href: z.string().nullish(),
  target: z.string().nullish(),
  icon: z.string(),
});

export const SkillGroupSchema = z.object({
  id: z.string(),
  heading: z.string(),
  items: z.array(z.string()),
});

export const ExperienceItemSchema = z.object({
  company: z.string(),
  location: z.string(),
  role: z.string(),
  dates: z.string(),
  datetime: z.string(),
  context: z.string().nullish(),
  bullets: z.array(z.string()),
  stack: z.string(),
});

export const EducationBulletSchema = z.object({
  text: z.string(),
  linkText: z.string().nullish(),
  href: z.string().nullish(),
});

export const EducationItemSchema = z.object({
  school: z.string(),
  location: z.string().nullish(),
  degree: z.string(),
  dates: z.string(),
  datetime: z.string(),
  context: z.string().nullish(),
  bullets: z.array(EducationBulletSchema),
});

export const ProjectLinkSchema = z.object({
  label: z.string(),
  href: z.string(),
});

export const ProjectItemSchema = z.object({
  title: z.string(),
  context: z.string(),
  links: z.array(ProjectLinkSchema),
  stack: z.string(),
});

export const CredentialSchema = z.object({
  id: z.string(),
  href: z.string(),
});

export const CertificationItemSchema = z.object({
  title: z.string(),
  issuer: z.string(),
  credentials: z.array(CredentialSchema).optional(),
});

/** The YAML frontmatter of the site CV (e.g. src/content/cv/en.md). */
export const CvDataSchema = z.object({
  header: z.object({
    name: z.string(),
    title: z.string(),
    tagline: z.string(),
  }),
  contact: z.object({ items: z.array(ContactItemSchema) }),
  skillGroups: z.array(SkillGroupSchema),
  summary: z.object({ heading: z.string() }),
  experience: z.object({ items: z.array(ExperienceItemSchema) }),
  education: z.object({ items: z.array(EducationItemSchema) }),
  projects: z.object({ items: z.array(ProjectItemSchema) }),
  certifications: z.object({ items: z.array(CertificationItemSchema) }),
  footer: z.object({
    languages: z.object({ items: z.array(z.string()) }),
    interests: z.object({ text: z.string() }),
    references: z.string(),
  }),
});

// ─── RxResume JSON ────────────────────────────────────────────────────────────
//
// Only the fields that patchResumeJson reads or writes are declared. The
// objects are loose, so every other field is carried through as `unknown` and
// no structural field is accidentally dropped.

export const ExperienceJsonItemSchema = z.looseObject({
  company: z.string(),
  position: z.string(),
  location: z.string(),
  period: z.string(),
  description: z.string(),
});

export const SkillJsonItemSchema = z.looseObject({
  name: z.string(),
  keywords: z.array(z.string()),
});

export const EducationJsonItemSchema = z.looseObject({
  school: z.string(),
  description: z.string(),
});

export const ProjectJsonItemSchema = z.looseObject({
  name: z.string(),
  description: z.string(),
});

export const CertJsonItemSchema = z.looseObject({
  title: z.string(),
  issuer: z.string(),
  description: z.string(),
});

export const LanguageJsonItemSchema = z.looseObject({
  language: z.string(),
  fluency: z.string(),
});

export const InterestJsonItemSchema = z.looseObject({
  name: z.string(),
});

/** The RxResume JSON file that patchResumeJson updates. */
export const ResumeJsonSchema = z.looseObject({
  summary: z.looseObject({ content: z.string() }),
  sections: z.looseObject({
    experience: z.looseObject({ items: z.array(ExperienceJsonItemSchema) }),
    skills: z.looseObject({ items: z.array(SkillJsonItemSchema) }),
    education: z.looseObject({ items: z.array(EducationJsonItemSchema) }),
    projects: z.looseObject({ items: z.array(ProjectJsonItemSchema) }),
    certifications: z.looseObject({ items: z.array(CertJsonItemSchema) }),
    languages: z.looseObject({ items: z.array(LanguageJsonItemSchema) }),
    interests: z.looseObject({ items: z.array(InterestJsonItemSchema) }),
  }),
});
