/**
 * types.ts
 *
 * Every type sync-resume uses, in one place. Data shapes are inferred from the
 * Zod schemas in schema.ts, which are the source of truth; only the shapes
 * that are not data (the Resume.md document model, file paths) are declared
 * here by hand.
 */

import type { z } from "zod";
import type { ValueOf } from "../utils/type.ts";
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

// ─── Resume.md document model ────────────────────────────────────────────────
//
// How parser.ts reads Resume.md before the section readers build the
// ParsedResume; see docs/GLOSSARY.md.

/** `## Heading` names the parser reads. */
export const SectionHeading = {
  Summary: "Summary",
  Experience: "Experience",
  Skills: "Technical Skills",
  Education: "Education",
  Projects: "Projects",
  Certifications: "Certifications",
  Languages: "Languages",
  Interests: "Interests",
  References: "References",
} as const;
export type SectionHeading = ValueOf<typeof SectionHeading>;

/** What a logical line of a section is. */
export enum LineKind {
  /** `---` */
  Rule = "rule",
  /** `- item` */
  Bullet = "bullet",
  /** `Reference: a, b`, plain or bold. */
  Reference = "reference",
  /** `**Tech Stack:** a, b` */
  TechStack = "techStack",
  /** `**Title** | dates` */
  Title = "title",
  /** `**Label** rest`: skill groups and certifications. */
  Labelled = "labelled",
  /** A sub-heading or bold markup no reader takes. */
  Markup = "markup",
  /** A bare `https://…` URL. */
  Url = "url",
  /** Only markdown links and `|` separators. */
  Links = "links",
  /** Any other text. */
  Paragraph = "paragraph",
}

export interface BulletLine {
  kind: LineKind.Bullet;
  text: string;
  /** The bullet without its `- `. */
  item: string;
}

export interface ReferenceLine {
  kind: LineKind.Reference;
  text: string;
  references: string[];
}

export interface TechStackLine {
  kind: LineKind.TechStack;
  text: string;
  stack: string;
}

export interface TitleLine {
  kind: LineKind.Title;
  text: string;
  title: string;
  period: string;
}

export interface LabelledLine {
  kind: LineKind.Labelled;
  text: string;
  label: string;
  rest: string;
}

export interface PlainLine<TKind extends LineKind> {
  kind: TKind;
  text: string;
}

/** A logical line as written (`text`) plus what its kind captures. */
export type Line =
  | BulletLine
  | ReferenceLine
  | TechStackLine
  | TitleLine
  | LabelledLine
  | PlainLine<LineKind.Rule>
  | PlainLine<LineKind.Markup>
  | PlainLine<LineKind.Url>
  | PlainLine<LineKind.Links>
  | PlainLine<LineKind.Paragraph>;
export type LineOf<TKind extends LineKind> = Extract<Line, { kind: TKind }>;

/** A `### Heading` block of a section. */
export interface Entry {
  heading: string;
  /** The lines under the heading, without rules. */
  lines: Line[];
}

export interface Section {
  /** Every logical line of the section, rules included. */
  lines: Line[];
  entries: Entry[];
}

export interface ResumeDocument {
  /** Trimmed, non-empty lines above the first `## ` heading, without rules. */
  header: string[];
  sections: Map<string, Section>;
}

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
