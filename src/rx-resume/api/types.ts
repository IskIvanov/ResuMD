/**
 * types.ts
 *
 * The Reactive Resume API's types. Its shapes are inferred from the Zod
 * schemas in schema.ts, which are the source of truth; only the shapes that
 * are not data (the client's config, the settings) are declared by hand.
 */

import type { z } from "zod";
import type { Env, FetchFn } from "../../utils/types.ts";
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
  InterestItemSchema,
  LanguageItemSchema,
  LayoutSchema,
  ProjectItemSchema,
  ReferenceItemSchema,
  ResumeSchema,
  ResumeDataSchema,
  SectionLayoutSchema,
  SkillItemSchema,
  UpdateCoverLetterBodySchema,
  UpdateResumeBodySchema,
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

// ─── Requests and responses ──────────────────────────────────────────────────────

export type CreateResumeBody = z.infer<typeof CreateResumeBodySchema>;
export type UpdateResumeBody = z.infer<typeof UpdateResumeBodySchema>;
export type Resume = z.infer<typeof ResumeSchema>;
export type CoverLetterTemplate = z.infer<typeof CoverLetterTemplateSchema>;
export type CoverLetterLayout = z.infer<typeof CoverLetterLayoutSchema>;
export type CreateCoverLetterBody = z.infer<typeof CreateCoverLetterBodySchema>;
export type UpdateCoverLetterBody = z.infer<typeof UpdateCoverLetterBodySchema>;
export type CoverLetter = z.infer<typeof CoverLetterSchema>;

/** Produces a unique item id; `crypto.randomUUID` in production. */
export type IdFactory = () => string;

// ─── Client and config ────────────────────────────────────────────────────────

/** Where the client writes a line per request and response, and its clock. */
export interface RequestLog {
  write: (line: string) => void;
  /** Milliseconds, for the time a request took. */
  now: () => number;
}

export interface RxResumeClientConfig extends ApiConfig {
  fetch: FetchFn;
  /** Set to log every request; left out, the client writes nothing. */
  requestLog?: RequestLog;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

/** Variables the Reactive Resume tools need from `.env`. */
export enum EnvVar {
  ApiKey = "RXRESUME_API_KEY",
  BaseUrl = "RXRESUME_API_URL",
  AppUrl = "RXRESUME_APP_URL",
}

/** Variables the tools read when set, and never ask for. */
export enum OptionalEnvVar {
  /** Any non-empty value logs every API request to stderr. */
  Debug = "RXRESUME_DEBUG",
}

// ─── Errors ───────────────────────────────────────────────────────────────────

/** The body of a failed response, when the API sent JSON. */
export interface ApiErrorBody {
  code?: unknown;
  message?: unknown;
}

export interface ApiConfig {
  apiKey: string;
  /** Base URL of the API, e.g. `https://rxresu.me/api/openapi`. */
  baseUrl: string;
  /** URL of the web app, e.g. `https://rxresu.me`; used for builder links. */
  appUrl: string;
}
