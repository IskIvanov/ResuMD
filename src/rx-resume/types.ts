/**
 * types.ts
 *
 * Every type the Reactive Resume tools use, in one place. API shapes are
 * inferred from the Zod schemas in schema.ts, which are the source of truth;
 * only the shapes that are not data (the client, its config, function
 * signatures) are declared here by hand.
 */

import type { z } from "zod";
import type { Env, FetchFn } from "../utils/types.ts";
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
  MetadataSchema,
  ProjectItemSchema,
  ReferenceItemSchema,
  ResumeSchema,
  ResumeDataSchema,
  SectionLayoutSchema,
  SkillItemSchema,
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
type SectionLayout = z.infer<typeof SectionLayoutSchema>;
export type Summary = z.infer<typeof SummarySchema>;
export type ExperienceItem = z.infer<typeof ExperienceItemSchema>;
export type SkillItem = z.infer<typeof SkillItemSchema>;
export type EducationItem = z.infer<typeof EducationItemSchema>;
export type ProjectItem = z.infer<typeof ProjectItemSchema>;
export type CertificationItem = z.infer<typeof CertificationItemSchema>;
export type LanguageItem = z.infer<typeof LanguageItemSchema>;
export type InterestItem = z.infer<typeof InterestItemSchema>;
export type ReferenceItem = z.infer<typeof ReferenceItemSchema>;
export type Layout = z.infer<typeof LayoutSchema>;
export type Metadata = z.infer<typeof MetadataSchema>;
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

export interface RxResumeClientConfig {
  baseUrl: string;
  apiKey: string;
  fetch: FetchFn;
  /** Set to log every request; left out, the client writes nothing. */
  requestLog?: RequestLog;
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

// ─── Connected handle ─────────────────────────────────────────────────────────

/** What connectRxResume needs from the outside world. */
export interface RxResumeDeps {
  /** Holds the `.env` settings; see EnvVar. */
  env: Env;
  fetch: FetchFn;
  /** Ids for the items written from Resume.md. */
  newId: IdFactory;
  /** Today's date as `YYYY-MM-DD`, the date a cover letter is written. */
  today: () => string;
  /**
   * Where a line per request and response goes when RXRESUME_DEBUG is set;
   * left out, nothing is logged.
   */
  requestLog?: RequestLog;
}

/** Rewrites an existing resume from Resume.md. */
export interface UpdateResumeInput {
  /** The resume's id, as generate prints it. */
  id: string;
  /** The full Resume.md text. */
  markdown: string;
}

/** Creates a new resume from Resume.md. */
export interface GenerateResumeInput {
  /** The full Resume.md text. */
  markdown: string;
  /** Shown in Reactive Resume. */
  name: string;
  /** Must be unused across your resumes. */
  slug: string;
  tags: string[];
}

/** The resume an operation wrote, and where to open it. */
export interface ResumeResult {
  id: string;
  name: string;
  slug: string;
  /** Opens the resume in the Reactive Resume builder. */
  builderUrl: string;
}

/** The operations on resumes. */
export interface ResumeOperations {
  /**
   * Creates a resume and fills it from Resume.md, its sections on one
   * full-width page in reading order. Server defaults fill the rest.
   */
  generate(input: GenerateResumeInput): Promise<ResumeResult>;
  /**
   * Rewrites a resume's data from Resume.md, keeping its layout, picture,
   * template and every section Resume.md doesn't feed.
   */
  update(input: UpdateResumeInput): Promise<ResumeResult>;
  /** Deletes a resume for good; rejected for a locked resume. */
  delete(id: string): Promise<void>;
}

/**
 * A cover letter's metadata. A field left undefined isn't sent. Each is typed
 * by the API field it's sent as, so retyping that field breaks the build here
 * rather than the request.
 */
export interface CoverLetterFields {
  name?: UpdateCoverLetterBody["name"];
  /** The resume that gives the letter its sender details and design. */
  resumeId?: UpdateCoverLetterBody["resumeId"];
  /** The job application the letter is for. */
  applicationId?: UpdateCoverLetterBody["applicationId"];
  /** Sent as `recipientCompany`. */
  company?: UpdateCoverLetterBody["recipientCompany"];
  /** Unlinks the resume's design when set. */
  template?: UpdateCoverLetterBody["template"];
}

/** A new letter's metadata: it needs a name and the resume it goes with. */
export interface NewCoverLetterFields extends CoverLetterFields {
  name: string;
  resumeId: string;
}

/** Creates a cover letter from its `.md`. */
export interface GenerateCoverLetterInput extends NewCoverLetterFields {
  /** The full cover-letter `.md` text. */
  markdown: string;
}

/** Rewrites a cover letter from its `.md`; a field left out keeps its value. */
export interface UpdateCoverLetterInput extends CoverLetterFields {
  /** The letter's id, as generate prints it. */
  id: string;
  /** The full cover-letter `.md` text. */
  markdown: string;
}

/** The letter an operation wrote, and where to open it. */
export interface CoverLetterResult {
  id: string;
  name: string;
  revision: number;
  /** Opens the letter on the Reactive Resume dashboard. */
  dashboardUrl: string;
}

/** The operations on cover letters. */
export interface CoverLetterOperations {
  /** Creates a freeform letter, dated today. */
  generate(input: GenerateCoverLetterInput): Promise<CoverLetterResult>;
  /**
   * Rewrites a freeform letter at the revision just read, dated today;
   * rejected if the letter changed in between.
   */
  update(input: UpdateCoverLetterInput): Promise<CoverLetterResult>;
  /** Moves a letter to Trash, then deletes it for good. */
  delete(id: string): Promise<void>;
}

/** Every operation the Reactive Resume platform offers. */
export interface RxResume {
  resumes: ResumeOperations;
  coverLetters: CoverLetterOperations;
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

/** Why an operation stopped; each code's details are in RxResumeErrorReason. */
export enum RxResumeErrorCode {
  /** A `.env` setting is missing or empty. */
  MissingSettings = "MISSING_SETTINGS",
  /** fetch rejected before any response: wrong URL, server down, TLS. */
  Unreachable = "UNREACHABLE",
  /** The letter's layout isn't freeform, so the `.md` would print twice. */
  NotFreeform = "NOT_FREEFORM",
  /** The letter was moved to Trash, but purging it failed. */
  LeftInTrash = "LEFT_IN_TRASH",
}

/** An RxResumeError's code with what its message needs, one shape per code. */
export type RxResumeErrorReason =
  | { code: RxResumeErrorCode.MissingSettings; missing: string[] }
  | {
      code: RxResumeErrorCode.Unreachable;
      method: string;
      url: string;
      /** The network error, with its code when the runtime gave one. */
      detail: string;
    }
  | {
      code: RxResumeErrorCode.NotFreeform;
      id: string;
      layout: CoverLetterLayout;
    }
  | {
      code: RxResumeErrorCode.LeftInTrash;
      id: string;
      /** Why the purge failed. */
      failure: string;
    };

/** The body of a failed response, when the API sent JSON. */
export interface ApiErrorBody {
  code?: unknown;
  message?: unknown;
}

export enum ErrorMessages {
  RxResumeApiError = "Reactive Resume API error",
  Failed = "failed:",
  CheckApiUrl = "(http or https, host, port) and that the server is running.",
}

export interface ApiConfig {
  apiKey: string;
  /** Base URL of the API, e.g. `https://rxresu.me/api/openapi`. */
  baseUrl: string;
  /** URL of the web app, e.g. `https://rxresu.me`; used for builder links. */
  appUrl: string;
}
