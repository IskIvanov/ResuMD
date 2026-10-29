/**
 * types.ts
 *
 * Every type the Reactive Resume tools use, in one place. API shapes are
 * inferred from the Zod schemas in schema.ts, which are the source of truth;
 * only the shapes that are not data (the client, its config, function
 * signatures) are declared here by hand.
 */

import type { z } from "zod";
import type {
  BasicsSchema,
  BasicsCustomFieldSchema,
  CertificationItemSchema,
  CoverLetterLayoutSchema,
  CoverLetterSchema,
  CoverLetterTemplateSchema,
  CreateCoverLetterBodySchema,
  CreateResumeBodySchema,
  EducationItemSchema,
  ExperienceItemSchema,
  ExperienceRoleSchema,
  InterestItemSchema,
  LanguageItemSchema,
  LayoutSchema,
  LayoutPageSchema,
  MetadataSchema,
  ProjectItemSchema,
  ReferenceItemSchema,
  ResumeSchema,
  ResumeDataSchema,
  ResumeSectionsSchema,
  SectionLayoutSchema,
  SkillItemSchema,
  SkillsSectionSchema,
  SummarySchema,
  UpdateCoverLetterBodySchema,
  UpdateResumeBodySchema,
  WebsiteSchema,
} from "./schema.ts";

export {
  CoverLetterLayout,
  CoverLetterTemplate,
  SkillKeywordLayout,
  SkillLayout,
} from "./schema.ts";

// ─── API shapes ──────────────────────────────────────────────────────────────────

export type Website = z.infer<typeof WebsiteSchema>;
export type BasicsCustomField = z.infer<typeof BasicsCustomFieldSchema>;
export type Basics = z.infer<typeof BasicsSchema>;
export type SectionLayout = z.infer<typeof SectionLayoutSchema>;
export type Summary = z.infer<typeof SummarySchema>;
export type ExperienceRole = z.infer<typeof ExperienceRoleSchema>;
export type ExperienceItem = z.infer<typeof ExperienceItemSchema>;
export type SkillItem = z.infer<typeof SkillItemSchema>;
export type SkillsSection = z.infer<typeof SkillsSectionSchema>;
export type EducationItem = z.infer<typeof EducationItemSchema>;
export type ProjectItem = z.infer<typeof ProjectItemSchema>;
export type CertificationItem = z.infer<typeof CertificationItemSchema>;
export type LanguageItem = z.infer<typeof LanguageItemSchema>;
export type InterestItem = z.infer<typeof InterestItemSchema>;
export type ReferenceItem = z.infer<typeof ReferenceItemSchema>;
export type LayoutPage = z.infer<typeof LayoutPageSchema>;
export type Layout = z.infer<typeof LayoutSchema>;
export type Metadata = z.infer<typeof MetadataSchema>;
/**
 * A section of `TItem`s: the shared layout fields plus the items themselves.
 */
export type Section<TItem> = SectionLayout & { items: TItem[] };
export type ResumeSections = z.infer<typeof ResumeSectionsSchema>;
export type ResumeData = z.infer<typeof ResumeDataSchema>;

// ─── Requests and responses ──────────────────────────────────────────────────────

export type CreateResumeBody = z.infer<typeof CreateResumeBodySchema>;
export type UpdateResumeBody = z.infer<typeof UpdateResumeBodySchema>;
export type Resume = z.infer<typeof ResumeSchema>;
export type CoverLetterTemplate = z.infer<typeof CoverLetterTemplateSchema>;
export type CoverLetterLayout = z.infer<typeof CoverLetterLayoutSchema>;
export type CreateCoverLetterBody = z.infer<typeof CreateCoverLetterBodySchema>;
export type UpdateCoverLetterBody = z.infer<typeof UpdateCoverLetterBodySchema>;
export type CoverLetter = z.infer<typeof CoverLetterSchema>;

// ─── Parsed subset ────────────────────────────────────────────────────────────
//
// The keys Resume.md can fill today. Each type is a `Pick` of the API shape,
// so a renamed or retyped API field breaks the build instead of the request.

/** A header link: an icon, its text and the URL it points to. */
export type ParsedCustomField = Pick<
  BasicsCustomField,
  "icon" | "text" | "link"
>;

export type ParsedBasicsData = Omit<Basics, "customFields"> & {
  customFields: ParsedCustomField[];
};

/** `website` is set only when the job has a company URL. */
export type ParsedExperienceItem = Pick<
  ExperienceItem,
  "company" | "position" | "location" | "period" | "description"
> &
  Partial<Pick<ExperienceItem, "website">>;

export type ParsedSkillItem = Pick<SkillItem, "name" | "keywords">;

export type ParsedEducationItem = Pick<
  EducationItem,
  "school" | "degree" | "area" | "grade" | "location" | "period" | "description"
>;

/** `website` is set only when the project has a link. */
export type ParsedProjectItem = Pick<ProjectItem, "name" | "description"> &
  Partial<Pick<ProjectItem, "website">>;

export type ParsedCertificationItem = Pick<
  CertificationItem,
  "title" | "issuer" | "description"
>;

export type ParsedLanguageItem = Pick<LanguageItem, "language" | "fluency">;

export type ParsedInterestItem = Pick<InterestItem, "name">;

export type ParsedReferenceItem = Pick<ReferenceItem, "name">;

/** Only the `items` of a section; its layout stays with the resume. */
type ParsedSection<TItem> = Pick<Section<TItem>, "items">;

export interface ParsedResumeData {
  basics: ParsedBasicsData;
  summary: Pick<Summary, "content">;
  sections: {
    experience: ParsedSection<ParsedExperienceItem>;
    skills: ParsedSection<ParsedSkillItem>;
    education: ParsedSection<ParsedEducationItem>;
    projects: ParsedSection<ParsedProjectItem>;
    certifications: ParsedSection<ParsedCertificationItem>;
    languages: ParsedSection<ParsedLanguageItem>;
    interests: ParsedSection<ParsedInterestItem>;
    references: ParsedSection<ParsedReferenceItem>;
  };
}

// ─── Applying parsed data ─────────────────────────────────────────────────────

/** Produces a unique item id; `crypto.randomUUID` in production. */
export type IdFactory = () => string;

/** Completes a parsed item into a full API item with the given id. */
export type ItemCompleter<TParsed, TItem> = (
  item: TParsed,
  id: string,
) => TItem;

// ─── Client and config ────────────────────────────────────────────────────────

/** The subset of `fetch` the client uses; `globalThis.fetch` satisfies it. */
export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export interface RxResumeClientConfig {
  baseUrl: string;
  apiKey: string;
  fetch: FetchFn;
}

export interface RxResumeClient {
  /** `POST /resumes`; resolves to the new resume's id. */
  createResume(body: CreateResumeBody): Promise<string>;
  /** `GET /resumes/{id}`. */
  getResume(id: string): Promise<Resume>;
  /** `PUT /resumes/{id}`; resolves to the updated resume. */
  updateResume(id: string, body: UpdateResumeBody): Promise<Resume>;
  /** `DELETE /resumes/{id}`; permanent, and rejected for a locked resume. */
  deleteResume(id: string): Promise<void>;
  /** `POST /cover-letters`; resolves to the new letter. */
  createCoverLetter(body: CreateCoverLetterBody): Promise<CoverLetter>;
  /** `GET /cover-letters/{id}`. */
  getCoverLetter(id: string): Promise<CoverLetter>;
  /**
   * `PUT /cover-letters/{id}`; resolves to the updated letter. Rejected when
   * `expectedRevision` is no longer the letter's revision.
   */
  updateCoverLetter(
    id: string,
    body: UpdateCoverLetterBody,
  ): Promise<CoverLetter>;
  /**
   * `DELETE /cover-letters/{id}`; moves the letter to Trash. Rejected for a
   * locked letter or a stale revision.
   */
  trashCoverLetter(id: string, expectedRevision: number): Promise<void>;
  /** `DELETE /documents/letter/{id}`; permanent, only for a letter in Trash. */
  removeCoverLetter(id: string): Promise<void>;
}

/** The client methods patchResumeData calls. */
export type PatchClient = Pick<RxResumeClient, "getResume" | "updateResume">;

/** Turns a resume's current data into the data to save. */
export type ResumeDataPatch = (data: ResumeData) => ResumeData;

/** The body of a failed response, when the API sent JSON. */
export interface ApiErrorBody {
  code?: unknown;
  message?: unknown;
}

export enum ErrorMessages {
  UnexpectedResponse = "Unexpected response from the API",
  InvalidId = "Invalid id provided",
  MissingApiKey = "Missing API key",
  RxResumeApiError = "Reactive Resume API error",
  MissingBody = "Missing request body",
}

/** Environment variables, usually `process.env` after Bun has loaded `.env`. */
export type Env = Record<string, string | undefined>;

export interface ApiConfig {
  apiKey: string;
  /** Base URL of the API, e.g. `https://rxresu.me/api/openapi`. */
  baseUrl: string;
  /** URL of the web app, e.g. `https://rxresu.me`; used for builder links. */
  appUrl: string;
}
