/**
 * types.ts
 *
 * The Reactive Resume API's types. Its shapes are inferred from the Zod
 * schemas in schema.ts, which are the source of truth; only the shapes that
 * are not data (the client's dependencies, the settings) are declared by hand.
 */

import type { z } from "zod";
import type { EnvironmentVariables, FetchFunction } from "../../utils/types.ts";
import type {
  BasicsSchema,
  BasicsCustomFieldSchema,
  CertificationItemSchema,
  CoverLetterLayoutSchema,
  CoverLetterSchema,
  CoverLetterTemplateSchema,
  CreateCoverLetterRequestSchema,
  CreateResumeRequestSchema,
  EducationItemSchema,
  ExperienceItemSchema,
  InterestItemSchema,
  LanguageItemSchema,
  LayoutSchema,
  ProjectItemSchema,
  ReferenceItemSchema,
  ResumeSchema,
  ResumeDataSchema,
  SectionLayoutSchema,
  SkillItemSchema,
  UpdateCoverLetterRequestSchema,
  UpdateResumeRequestSchema,
  WebsiteSchema,
} from "./schema.ts";

export { CoverLetterLayout, CoverLetterTemplate } from "./schema.ts";

// ─── API shapes ──────────────────────────────────────────────────────────────────

export type Website = z.infer<typeof WebsiteSchema>;
export type BasicsCustomField = z.infer<typeof BasicsCustomFieldSchema>;
export type Basics = z.infer<typeof BasicsSchema>;
type SectionLayout = z.infer<typeof SectionLayoutSchema>;
export type ExperienceItem = z.infer<typeof ExperienceItemSchema>;
export type SkillItem = z.infer<typeof SkillItemSchema>;
export type EducationItem = z.infer<typeof EducationItemSchema>;
export type ProjectItem = z.infer<typeof ProjectItemSchema>;
export type CertificationItem = z.infer<typeof CertificationItemSchema>;
export type LanguageItem = z.infer<typeof LanguageItemSchema>;
export type InterestItem = z.infer<typeof InterestItemSchema>;
export type ReferenceItem = z.infer<typeof ReferenceItemSchema>;
export type Layout = z.infer<typeof LayoutSchema>;
/**
 * A section of `TItem`s: the shared layout fields plus the items themselves.
 */
export type Section<TItem> = SectionLayout & { items: TItem[] };
export type ResumeData = z.infer<typeof ResumeDataSchema>;

// ─── What the endpoints take and return ──────────────────────────────────────────

/** The JSON sent to `POST /resumes`. */
export type CreateResumeRequest = z.infer<typeof CreateResumeRequestSchema>;
/** The JSON sent to `PUT /resumes/{id}`. */
export type UpdateResumeRequest = z.infer<typeof UpdateResumeRequestSchema>;
export type Resume = z.infer<typeof ResumeSchema>;
export type CoverLetterTemplate = z.infer<typeof CoverLetterTemplateSchema>;
export type CoverLetterLayout = z.infer<typeof CoverLetterLayoutSchema>;
/** The JSON sent to `POST /cover-letters`. */
export type CreateCoverLetterRequest = z.infer<
  typeof CreateCoverLetterRequestSchema
>;
/** The JSON sent to `PUT /cover-letters/{id}`. */
export type UpdateCoverLetterRequest = z.infer<
  typeof UpdateCoverLetterRequestSchema
>;
export type CoverLetter = z.infer<typeof CoverLetterSchema>;

/** Produces a unique item id; `crypto.randomUUID` in production. */
export type IdFactory = () => string;

// ─── Client ───────────────────────────────────────────────────────────────────

/** Where the client writes a line per API call and its answer, and its clock. */
export interface ApiCallLog {
  write: (line: string) => void;
  /** Milliseconds, for the time a call took. */
  now: () => number;
}

/** The settings and injected I/O the client runs with. */
export interface RxResumeClientDependencies extends RxResumeSettings {
  fetch: FetchFunction;
  /** Set to log every API call; left out, the client writes nothing. */
  apiCallLog?: ApiCallLog;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

/** What the tools need to reach a Reactive Resume instance, read from `.env`. */
interface RxResumeSettings {
  apiKey: string;
  /** The REST API's address, e.g. `https://rxresu.me/api/openapi`. */
  apiUrl: string;
  /** The web app's address, e.g. `https://rxresu.me`; used for editor links. */
  appUrl: string;
}

/** The environment variables that hold the settings, set in `.env`. */
export enum EnvironmentVariable {
  ApiKey = "RXRESUME_API_KEY",
  ApiUrl = "RXRESUME_API_URL",
  AppUrl = "RXRESUME_APP_URL",
}

/** Variables the tools read when set, and never ask for. */
export enum OptionalEnvironmentVariable {
  /** Any non-empty value logs every API call to stderr. */
  Debug = "RXRESUME_DEBUG",
}

// ─── Errors ───────────────────────────────────────────────────────────────────

/** What a failed response's JSON says, when the API sent JSON. */
export interface ApiErrorDetails {
  code?: unknown;
  message?: unknown;
}
