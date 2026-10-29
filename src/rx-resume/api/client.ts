/**
 * client.ts
 *
 * A minimal Reactive Resume API client for the resume and cover-letter
 * endpoints. `fetch` is injected, so the client holds no global state and is
 * tested without a network.
 */

import { describeCaught } from "../../utils/error.ts";
import type { FetchFn, ValueOf } from "../../utils/types.ts";
import {
  type ApiErrorBody,
  type CoverLetter,
  type CreateCoverLetterBody,
  type CreateResumeBody,
  EnvVar,
  type RequestLog,
  type Resume,
  type RxResumeClientConfig,
  type UpdateCoverLetterBody,
  type UpdateResumeBody,
} from "./types.ts";

/** Header carrying the API key. */
const ApiKeyHeader = "x-api-key";

const ContentType = {
  Header: "content-type",
  Json: "application/json",
} as const;

const HttpMethod = {
  Get: "GET",
  Post: "POST",
  Put: "PUT",
  Delete: "DELETE",
} as const;
type HttpMethod = ValueOf<typeof HttpMethod>;

const RESUMES_PATH = "/resumes";
/** Where the web app opens a resume. */
const BUILDER_PATH = "/builder";
/** Where the web app lists a cover letter. */
const LETTER_DASHBOARD_PATH = "/dashboard";
const COVER_LETTERS_PATH = "/cover-letters";
/** Where a letter already in Trash is deleted for good. */
const LETTER_DOCUMENTS_PATH = "/documents/letter";

/** One or more slashes at the end of a URL. */
const TRAILING_SLASHES = /\/+$/;

/** Drops the slashes at the end of a URL, so a path can be appended. */
function trimTrailingSlashes(url: string): string {
  return url.replace(TRAILING_SLASHES, "");
}

/** `collection/id`, with the id URL-encoded. */
function itemPath(collection: string, id: string): string {
  return `${collection}/${encodeURIComponent(id)}`;
}

/** A non-2xx response, with the API's error code when it sent one. */
export class RxResumeApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, code: string | undefined, message: string) {
    super(
      `Reactive Resume API error ${status}${code ? ` ${code}` : ""}: ${message}`,
    );
    this.name = "RxResumeApiError";
    this.status = status;
    this.code = code;
  }
}

/** Builds an RxResumeApiError from a failed response, JSON body or not. */
async function toApiError(response: Response): Promise<RxResumeApiError> {
  const text = await response.text();
  let body: ApiErrorBody = {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null) body = parsed;
  } catch {
    // Not JSON (e.g. a proxy error page); fall back to the raw text.
  }
  const code = typeof body.code === "string" ? body.code : undefined;
  const message =
    typeof body.message === "string"
      ? body.message
      : text || response.statusText;
  return new RxResumeApiError(response.status, code, message);
}

/** `/resumes/{id}`. */
function resumePath(id: string): string {
  return itemPath(RESUMES_PATH, id);
}

/** `/cover-letters/{id}`. */
function letterPath(id: string): string {
  return itemPath(COVER_LETTERS_PATH, id);
}

/**
 * A client for the Reactive Resume resume and cover-letter endpoints. Each
 * method rejects with RxResumeApiError on a non-2xx response.
 *
 * @example
 * const client = new RxResumeApiClient({ baseUrl, apiKey, fetch });
 * const id = await client.createResume({ name: "CV", slug: "cv", tags: [] });
 */
export class RxResumeApiClient {
  readonly baseUrl: string;
  readonly appUrl: string;
  readonly apiKey: string;
  readonly fetch: FetchFn;
  readonly requestLog: RequestLog | undefined;

  /**
   * @param config - Base URL (e.g. `https://rxresu.me/api/openapi`), app URL
   *   (e.g. `https://rxresu.me`) for links, API key, the `fetch`
   *   implementation to send requests with, and an optional log for every
   *   request.
   */
  constructor(config: RxResumeClientConfig) {
    this.baseUrl = trimTrailingSlashes(config.baseUrl);
    this.appUrl = trimTrailingSlashes(config.appUrl);
    this.apiKey = config.apiKey;
    this.fetch = config.fetch;
    this.requestLog = config.requestLog;
  }

  /** Sends one request and returns its JSON body, or undefined if empty. */
  async request(
    method: HttpMethod,
    path: string,
    body?: object,
  ): Promise<unknown> {
    const headers = new Headers({ [ApiKeyHeader]: this.apiKey });
    const url = `${this.baseUrl}${path}`;

    if (body) headers.set(ContentType.Header, ContentType.Json);

    const options: RequestInit = {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    };

    const startedAt = this.requestLog?.now();
    this.requestLog?.write(`→ ${method} ${url}`);

    let response: Response;
    try {
      response = await this.fetch(url, options);
    } catch (error) {
      throw new Error(
        `${method} ${url} failed: ${describeCaught(error)}\n` +
          `Check ${EnvVar.BaseUrl} (http or https, host, port) and that the ` +
          "server is running.",
        { cause: error },
      );
    }

    if (this.requestLog && startedAt !== undefined) {
      const took = Math.round(this.requestLog.now() - startedAt);
      this.requestLog.write(
        `← ${response.status} ${method} ${url} (${took}ms)`,
      );
    }

    if (!response.ok) throw await toApiError(response);
    // DELETE replies with an empty body, which response.json() rejects.
    const text = await response.text();
    return text ? JSON.parse(text) : undefined;
  }

  /**
   * Builds the link that opens a resume in the web app's builder.
   *
   * @param resumeId - The resume's id.
   * @returns The builder URL, with the id URL-encoded.
   *
   * @example
   * client.builderUrl("abc"); // "https://rxresu.me/builder/abc"
   */
  builderUrl(resumeId: string): string {
    return itemPath(`${this.appUrl}${BUILDER_PATH}`, resumeId);
  }

  /**
   * Builds the link to a cover letter on the web app's dashboard.
   *
   * @param letterId - The cover letter's id.
   * @returns The dashboard URL, with the id URL-encoded.
   *
   * @example
   * client.letterUrl("abc"); // "https://rxresu.me/dashboard/abc"
   */
  letterUrl(letterId: string): string {
    return itemPath(`${this.appUrl}${LETTER_DASHBOARD_PATH}`, letterId);
  }

  /** `POST /resumes`; resolves to the new resume's id. */
  async createResume(body: CreateResumeBody): Promise<string> {
    const id = await this.request(HttpMethod.Post, RESUMES_PATH, body);
    if (typeof id !== "string") {
      throw new Error(
        `POST ${RESUMES_PATH}: expected a resume id, got ${JSON.stringify(id)}`,
      );
    }
    return id;
  }

  /** `GET /resumes/{id}`. */
  async getResume(id: string): Promise<Resume> {
    // Trusts the API's documented response shape; not validated at runtime.
    return (await this.request(HttpMethod.Get, resumePath(id))) as Resume;
  }

  /** `PUT /resumes/{id}`; resolves to the updated resume. */
  async updateResume(id: string, body: UpdateResumeBody): Promise<Resume> {
    // Trusts the API's documented response shape; not validated at runtime.
    return (await this.request(HttpMethod.Put, resumePath(id), body)) as Resume;
  }

  /** `DELETE /resumes/{id}`; permanent, and rejected for a locked resume. */
  async deleteResume(id: string): Promise<void> {
    await this.request(HttpMethod.Delete, resumePath(id));
  }

  /** `POST /cover-letters`; resolves to the new letter. */
  async createCoverLetter(body: CreateCoverLetterBody): Promise<CoverLetter> {
    // Unlike POST /resumes, this returns the whole letter, not only its id.
    // Trusts the API's documented response shape; not validated at runtime.
    const coverLetterPostRequest = (await this.request(
      HttpMethod.Post,
      COVER_LETTERS_PATH,
      body,
    )) as CoverLetter;
    return coverLetterPostRequest;
  }

  /** `GET /cover-letters/{id}`. */
  async getCoverLetter(id: string): Promise<CoverLetter> {
    // Trusts the API's documented response shape; not validated at runtime.
    return (await this.request(HttpMethod.Get, letterPath(id))) as CoverLetter;
  }

  /**
   * `PUT /cover-letters/{id}`; resolves to the updated letter. Rejected when
   * `expectedRevision` is no longer the letter's revision.
   */
  async updateCoverLetter(
    id: string,
    body: UpdateCoverLetterBody,
  ): Promise<CoverLetter> {
    // Trusts the API's documented response shape; not validated at runtime.
    const coverLetterUpdateRequest = (await this.request(
      HttpMethod.Put,
      letterPath(id),
      body,
    )) as CoverLetter;

    return coverLetterUpdateRequest;
  }

  /**
   * `DELETE /cover-letters/{id}`; moves the letter to Trash. Rejected for a
   * locked letter or a stale revision.
   */
  async trashCoverLetter(id: string, expectedRevision: number): Promise<void> {
    await this.request(HttpMethod.Delete, letterPath(id), {
      expectedRevision,
    });
  }

  /** `DELETE /documents/letter/{id}`; permanent, only for a letter in Trash. */
  async removeCoverLetter(id: string): Promise<void> {
    await this.request(HttpMethod.Delete, itemPath(LETTER_DOCUMENTS_PATH, id));
  }
}
