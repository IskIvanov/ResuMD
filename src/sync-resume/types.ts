/**
 * types.ts
 *
 * Every type sync-resume uses, in one place. Data shapes are inferred from the
 * Zod schemas in schema.ts, which are the source of truth; only the shapes
 * that are not data (file paths) are declared here by hand.
 */

import type { z } from "zod";
import type {
  CertificationItemSchema,
  CertJsonItemSchema,
  ContactItemSchema,
  CredentialSchema,
  CvDataSchema,
  EducationBulletSchema,
  EducationItemSchema,
  EducationJsonItemSchema,
  ExperienceItemSchema,
  ExperienceJsonItemSchema,
  InterestJsonItemSchema,
  LanguageJsonItemSchema,
  ParsedCertificationSchema,
  ParsedContactSchema,
  ParsedEduItemSchema,
  ParsedJobSchema,
  ParsedLanguageSchema,
  ParsedLinkSchema,
  ParsedProjectSchema,
  ParsedResumeSchema,
  ParsedSkillGroupSchema,
  ProjectItemSchema,
  ProjectJsonItemSchema,
  ProjectLinkSchema,
  ResumeJsonSchema,
  SkillGroupSchema,
  SkillJsonItemSchema,
} from "./schema.ts";

// ─── Parsed Resume.md ─────────────────────────────────────────────────────────

export type ParsedLink = z.infer<typeof ParsedLinkSchema>;
export type ParsedContact = z.infer<typeof ParsedContactSchema>;
export type ParsedJob = z.infer<typeof ParsedJobSchema>;
export type ParsedSkillGroup = z.infer<typeof ParsedSkillGroupSchema>;
export type ParsedEduItem = z.infer<typeof ParsedEduItemSchema>;
export type ParsedProject = z.infer<typeof ParsedProjectSchema>;
export type ParsedCertification = z.infer<typeof ParsedCertificationSchema>;
export type ParsedLanguage = z.infer<typeof ParsedLanguageSchema>;
export type ParsedResume = z.infer<typeof ParsedResumeSchema>;

// ─── Site CV frontmatter ──────────────────────────────────────────────────────

export type ContactItem = z.infer<typeof ContactItemSchema>;
export type SkillGroup = z.infer<typeof SkillGroupSchema>;
export type ExperienceItem = z.infer<typeof ExperienceItemSchema>;
export type EducationBullet = z.infer<typeof EducationBulletSchema>;
export type EducationItem = z.infer<typeof EducationItemSchema>;
export type ProjectLink = z.infer<typeof ProjectLinkSchema>;
export type ProjectItem = z.infer<typeof ProjectItemSchema>;
export type Credential = z.infer<typeof CredentialSchema>;
export type CertificationItem = z.infer<typeof CertificationItemSchema>;
export type CvData = z.infer<typeof CvDataSchema>;

// ─── RxResume JSON ────────────────────────────────────────────────────────────

export type ExperienceJsonItem = z.infer<typeof ExperienceJsonItemSchema>;
export type SkillJsonItem = z.infer<typeof SkillJsonItemSchema>;
export type EducationJsonItem = z.infer<typeof EducationJsonItemSchema>;
export type ProjectJsonItem = z.infer<typeof ProjectJsonItemSchema>;
export type CertJsonItem = z.infer<typeof CertJsonItemSchema>;
export type LanguageJsonItem = z.infer<typeof LanguageJsonItemSchema>;
export type InterestJsonItem = z.infer<typeof InterestJsonItemSchema>;
export type ResumeJson = z.infer<typeof ResumeJsonSchema>;

// ─── CLI ──────────────────────────────────────────────────────────────────────

/** Absolute paths the sync run reads from and writes to. */
export interface SyncPaths {
  /** Site CV markdown with YAML frontmatter (e.g. src/content/cv/en.md). */
  cv: string;
  /** Source-of-truth Resume.md. Lives outside this package. */
  resume: string;
  /** RxResume JSON to patch; created from `template` when it does not exist. */
  json: string;
  /** RxResume template used to seed `json`. */
  template: string;
}
