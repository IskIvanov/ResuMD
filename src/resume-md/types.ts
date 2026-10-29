/**
 * types.ts
 *
 * Every type resume-md uses, in one place. Data shapes are inferred from the
 * Zod schemas in schema.ts, which are the source of truth; only the shapes
 * that are not data (the Resume.md outline and its lines) are declared here
 * by hand.
 */

import type { z } from "zod";
import type { ValueOf } from "../utils/types.ts";
import type {
  CertificationSchema,
  HeaderSchema,
  JobSchema,
  LanguageSchema,
  LinkSchema,
  ProjectSchema,
  ResumeMdSchema,
  SchoolSchema,
  SkillGroupSchema,
} from "./schema.ts";

// ─── What Resume.md says ──────────────────────────────────────────────────────

export type Link = z.infer<typeof LinkSchema>;
export type Header = z.infer<typeof HeaderSchema>;
export type Job = z.infer<typeof JobSchema>;
export type SkillGroup = z.infer<typeof SkillGroupSchema>;
export type School = z.infer<typeof SchoolSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Certification = z.infer<typeof CertificationSchema>;
export type Language = z.infer<typeof LanguageSchema>;
export type ResumeMd = z.infer<typeof ResumeMdSchema>;

// ─── The Resume.md outline ───────────────────────────────────────────────────
//
// How parser.ts reads Resume.md before the section readers build the
// ResumeMd; see docs/GLOSSARY.md.

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
  /** `- text` */
  Bullet = "bullet",
  /** `Reference: a, b`, plain or bold. */
  Reference = "reference",
  /** `**Tech Stack:** a, b` */
  TechStack = "techStack",
  /** `**Title** | dates` */
  Title = "title",
  /** `**Label** value`: skill groups and certifications. */
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

interface BulletLine {
  kind: LineKind.Bullet;
  text: string;
  /** The bullet without its `- `. */
  bulletText: string;
}

interface ReferenceLine {
  kind: LineKind.Reference;
  text: string;
  references: string[];
}

interface TechStackLine {
  kind: LineKind.TechStack;
  text: string;
  techStack: string;
}

interface TitleLine {
  kind: LineKind.Title;
  text: string;
  title: string;
  period: string;
}

interface LabelledLine {
  kind: LineKind.Labelled;
  text: string;
  label: string;
  /** Everything after the bold label. */
  value: string;
}

interface PlainLine<TKind extends LineKind> {
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

/** Resume.md read once into its header lines and sections. */
export interface ResumeOutline {
  /** Trimmed, non-empty lines above the first `## ` heading, without rules. */
  headerLines: string[];
  sections: Map<string, Section>;
}
