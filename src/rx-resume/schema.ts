/**
 * schema.ts
 *
 * Zod schemas for the Reactive Resume v5 API: the resume `data` object, the
 * bodies of `POST /resumes` and `PUT /resumes/{id}`, and the cover-letter
 * bodies and response. They are the source of truth for the types in
 * types.ts, which are inferred from them. Only the parts that Resume.md and
 * the cover-letter `.md` feed are declared in full; see
 * https://rxresu.me/api/openapi/spec.json for the complete schema.
 *
 * API responses are not validated against these schemas yet. Blocks the tools
 * do not read are declared loose, so parsing carries them through untouched.
 */

import { z } from "zod";

// ─── Basics ───────────────────────────────────────────────────────────────────

export const WebsiteSchema = z.object({
  url: z.string(),
  label: z.string(),
  inlineLink: z.boolean(),
});

export const BasicsCustomFieldSchema = z.object({
  id: z.string(),
  icon: z.string(),
  text: z.string(),
  link: z.string(),
});

export const BasicsSchema = z.object({
  name: z.string(),
  headline: z.string(),
  email: z.string(),
  phone: z.string(),
  location: z.string(),
  /** `url` needs a protocol; an empty `label` displays the URL as-is. */
  website: WebsiteSchema.pick({ url: true, label: true }),
  customFields: z.array(BasicsCustomFieldSchema),
});

// ─── Sections ─────────────────────────────────────────────────────────────────

/** Layout fields shared by the summary and every section. */
export const SectionLayoutSchema = z.object({
  title: z.string(),
  /** Phosphor icon name; empty string uses the template default. */
  icon: z.string(),
  /** 1–6. */
  columns: z.number(),
  hidden: z.boolean(),
  showHeading: z.boolean().optional(),
  keepTogether: z.boolean(),
  startOnNewPage: z.boolean(),
});

export const SummarySchema = SectionLayoutSchema.extend({
  /** HTML. */
  content: z.string(),
});

const SectionItemSchema = z.object({
  id: z.string(),
  hidden: z.boolean(),
});

const ExperienceRoleSchema = z.object({
  id: z.string(),
  position: z.string(),
  period: z.string(),
  /** HTML. */
  description: z.string(),
});

export const ExperienceItemSchema = SectionItemSchema.extend({
  company: z.string(),
  position: z.string(),
  location: z.string(),
  period: z.string(),
  website: WebsiteSchema,
  /** HTML. */
  description: z.string(),
  roles: z.array(ExperienceRoleSchema),
});

export const SkillItemSchema = SectionItemSchema.extend({
  icon: z.string(),
  iconColor: z.string(),
  name: z.string(),
  proficiency: z.string(),
  /** 0–5; 0 hides the level indicator. */
  level: z.number(),
  keywords: z.array(z.string()),
});

export const SkillKeywordLayout = { Inline: "inline", List: "list" } as const;
export const SkillLayout = { Default: "default", Inline: "inline" } as const;

export const EducationItemSchema = SectionItemSchema.extend({
  school: z.string(),
  degree: z.string(),
  area: z.string(),
  grade: z.string(),
  location: z.string(),
  period: z.string(),
  website: WebsiteSchema,
  /** HTML. */
  description: z.string(),
});

export const ProjectItemSchema = SectionItemSchema.extend({
  name: z.string(),
  period: z.string(),
  website: WebsiteSchema,
  /** HTML. */
  description: z.string(),
});

export const CertificationItemSchema = SectionItemSchema.extend({
  title: z.string(),
  issuer: z.string(),
  date: z.string(),
  website: WebsiteSchema,
  /** HTML. */
  description: z.string(),
});

export const LanguageItemSchema = SectionItemSchema.extend({
  language: z.string(),
  fluency: z.string(),
  /** 0–5; 0 hides the level indicator. */
  level: z.number(),
});

export const InterestItemSchema = SectionItemSchema.extend({
  icon: z.string(),
  iconColor: z.string(),
  name: z.string(),
  keywords: z.array(z.string()),
});

export const ReferenceItemSchema = SectionItemSchema.extend({
  /** A person's name, or a note such as "Available upon request". */
  name: z.string(),
  position: z.string(),
  website: WebsiteSchema,
  phone: z.string(),
  /** HTML. */
  description: z.string(),
});

const ExperienceSectionSchema = SectionLayoutSchema.extend({
  items: z.array(ExperienceItemSchema),
});

const SkillsSectionSchema = SectionLayoutSchema.extend({
  items: z.array(SkillItemSchema),
  keywordLayout: z.enum(SkillKeywordLayout).optional(),
  layout: z.enum(SkillLayout).optional(),
});

const EducationSectionSchema = SectionLayoutSchema.extend({
  items: z.array(EducationItemSchema),
});

const ProjectsSectionSchema = SectionLayoutSchema.extend({
  items: z.array(ProjectItemSchema),
});

const CertificationsSectionSchema = SectionLayoutSchema.extend({
  items: z.array(CertificationItemSchema),
});

const LanguagesSectionSchema = SectionLayoutSchema.extend({
  items: z.array(LanguageItemSchema),
});

const InterestsSectionSchema = SectionLayoutSchema.extend({
  items: z.array(InterestItemSchema),
});

const ReferencesSectionSchema = SectionLayoutSchema.extend({
  items: z.array(ReferenceItemSchema),
});

/**
 * The sections Resume.md feeds. The API requires every other section too;
 * they are carried through untyped so an update never drops them.
 */
const ResumeSectionsSchema = z.looseObject({
  experience: ExperienceSectionSchema,
  skills: SkillsSectionSchema,
  education: EducationSectionSchema,
  projects: ProjectsSectionSchema,
  certifications: CertificationsSectionSchema,
  languages: LanguagesSectionSchema,
  interests: InterestsSectionSchema,
  references: ReferencesSectionSchema,
});

// ─── Metadata ─────────────────────────────────────────────────────────────────

const LayoutPageSchema = z.object({
  /** True when the main column spans the page and the sidebar is empty. */
  fullWidth: z.boolean(),
  /** Section ids, in display order. */
  main: z.array(z.string()),
  /** Section ids, in display order. */
  sidebar: z.array(z.string()),
});

export const LayoutSchema = z.object({
  /** Percentage of the page width, 10–50. */
  sidebarWidth: z.number(),
  pages: z.array(LayoutPageSchema),
});

/** Template and design settings; untyped fields are carried through. */
export const MetadataSchema = z.looseObject({
  layout: LayoutSchema,
});

// ─── Resume data ──────────────────────────────────────────────────────────────

/** The `data` object of a resume; untyped blocks are carried through. */
export const ResumeDataSchema = z.looseObject({
  basics: BasicsSchema,
  summary: SummarySchema,
  sections: ResumeSectionsSchema,
  metadata: MetadataSchema,
});

// ─── Requests and responses ───────────────────────────────────────────────────

/** Body of `POST /resumes`. */
export const CreateResumeBodySchema = z.object({
  name: z.string(),
  slug: z.string(),
  tags: z.array(z.string()),
  withSampleData: z.boolean().optional(),
});

/** Body of `PUT /resumes/{id}`. Every field is optional. */
export const UpdateResumeBodySchema = z.object({
  name: z.string().optional(),
  slug: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  showDownloadButtons: z.boolean().optional(),
  /** Validated in full: every required block, section and item field. */
  data: ResumeDataSchema.optional(),
});

/** Response of `GET /resumes/{id}` and `PUT /resumes/{id}`. */
export const ResumeSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  tags: z.array(z.string()),
  isPublic: z.boolean(),
  showDownloadButtons: z.boolean(),
  isLocked: z.boolean(),
  hasPassword: z.boolean(),
  updatedAt: z.string(),
  data: ResumeDataSchema,
});

// ─── Cover letters ────────────────────────────────────────────────────────────

/** Templates a letter can use; setting one unlinks the resume's design. */
export const CoverLetterTemplate = {
  Azurill: "azurill",
  Bronzor: "bronzor",
  Chikorita: "chikorita",
  Ditgar: "ditgar",
  Ditto: "ditto",
  Gengar: "gengar",
  Glalie: "glalie",
  Kakuna: "kakuna",
  Lapras: "lapras",
  Leafish: "leafish",
  Meowth: "meowth",
  Onyx: "onyx",
  Pikachu: "pikachu",
  Porygon: "porygon",
  Rhyhorn: "rhyhorn",
  Scizor: "scizor",
  Smeargle: "smeargle",
} as const;

/**
 * `structured` builds a greeting and sign-off from the recipient fields;
 * `freeform` prints the recipient block and body as written.
 */
export const CoverLetterLayout = {
  Structured: "structured",
  Freeform: "freeform",
} as const;

/** The API's length limits on a letter's text fields, in characters. */
export const CoverLetterLimit = {
  NameMax: 100,
  RecipientMax: 20_000,
  ContentMax: 100_000,
  RecipientCompanyMax: 200,
} as const;

export const CoverLetterTemplateSchema = z.enum(CoverLetterTemplate);

export const CoverLetterLayoutSchema = z.enum(CoverLetterLayout);

/** Body of `POST /cover-letters`. Only `name` is required by the API. */
export const CreateCoverLetterBodySchema = z.object({
  name: z.string().min(1).max(CoverLetterLimit.NameMax),
  /** Plain text: the block above the greeting. */
  recipient: z.string().max(CoverLetterLimit.RecipientMax).optional(),
  /** Plain text, not HTML. */
  content: z.string().max(CoverLetterLimit.ContentMax).optional(),
  /** Links the sender's details and the design to this resume. */
  resumeId: z.string().min(1).optional(),
  applicationId: z.string().min(1).optional(),
  recipientCompany: z
    .string()
    .max(CoverLetterLimit.RecipientCompanyMax)
    .optional(),
  template: CoverLetterTemplateSchema.optional(),
  layout: CoverLetterLayoutSchema.optional(),
  /** `YYYY-MM-DD`. */
  letterDate: z.iso.date().optional(),
});

/**
 * Body of `PUT /cover-letters/{id}`. Every field is optional except
 * `expectedRevision`, and the layout can't be changed.
 */
export const UpdateCoverLetterBodySchema = CreateCoverLetterBodySchema.omit({
  layout: true,
})
  .partial()
  .extend({
    /** The revision last read; a newer one rejects the update. */
    expectedRevision: z.int().min(1),
  });

/**
 * Response of the cover-letter endpoints. Only the fields the tools read are
 * declared; every other field is carried through untouched.
 */
export const CoverLetterSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  revision: z.int().min(1),
  recipient: z.string(),
  content: z.string(),
  layout: CoverLetterLayoutSchema,
  recipientCompany: z.string(),
  letterDate: z.iso.date().nullable(),
  /** The sender's details come live from the linked resume. */
  senderLinked: z.boolean(),
  /** The design comes live from the linked resume. */
  designLinked: z.boolean(),
  /** A locked letter can't be edited or moved to Trash. */
  isLocked: z.boolean(),
  /** The sender's details as printed; other style settings untyped. */
  style: z.looseObject({ basics: BasicsSchema }),
});
