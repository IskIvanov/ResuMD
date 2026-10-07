/**
 * client.ts
 *
 * A minimal Reactive Resume API client for the resume and cover-letter
 * endpoints. `fetch` is injected, so the client holds no global state and is
 * tested without a network.
 */

import type { ValueOf } from "../utils/type.ts";
import { itemPath, trimTrailingSlashes } from "../utils/url.ts";
import {
  ErrorMessages,
  type ApiErrorBody,
  type CoverLetter,
  type CreateCoverLetterBody,
  type CreateResumeBody,
  type FetchFn,
  type Resume,
  type RxResumeClient,
  type RxResumeClientConfig,
  type UpdateCoverLetterBody,
  type UpdateResumeBody,
} from "./types.ts";

/** Header carrying the API key. */
export const ApiKeyHeader = "x-api-key";

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
const COVER_LETTERS_PATH = "/cover-letters";
/** Where a letter already in Trash is deleted for good. */
const LETTER_DOCUMENTS_PATH = "/documents/letter";

/** A non-2xx response, with the API's error code when it sent one. */
export class RxResumeApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, code: string | undefined, message: string) {
    super(
      `${ErrorMessages.RxResumeApiError} ${status}${code ? ` ${code}` : ""}: ${message}`,
    );
    this.name = ErrorMessages.RxResumeApiError;
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
export class RxResumeApiClient implements RxResumeClient {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly fetch: FetchFn;

  /**
   * @param config - Base URL (e.g. `https://rxresu.me/api/openapi`), API key
   *   and the `fetch` implementation to send requests with.
   */
  constructor(config: RxResumeClientConfig) {
    this.baseUrl = trimTrailingSlashes(config.baseUrl);
    this.apiKey = config.apiKey;
    this.fetch = config.fetch;
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

    const response = await this.fetch(url, options);

    console.log(await response.clone().text());

    if (!response.ok) throw await toApiError(response);
    // DELETE replies with an empty body, which response.json() rejects.
    const text = await response.text();
    return text ? JSON.parse(text) : undefined;
  }

  async createResume(body: CreateResumeBody): Promise<string> {
    const id = await this.request(HttpMethod.Post, RESUMES_PATH, body);
    if (typeof id !== "string") {
      throw new Error(
        `POST ${RESUMES_PATH}: expected a resume id, got ${JSON.stringify(id)}`,
      );
    }
    return id;
  }

  async getResume(id: string): Promise<Resume> {
    // Trusts the API's documented response shape; not validated at runtime.
    return (await this.request(HttpMethod.Get, resumePath(id))) as Resume;
  }

  async updateResume(id: string, body: UpdateResumeBody): Promise<Resume> {
    // Trusts the API's documented response shape; not validated at runtime.
    return (await this.request(HttpMethod.Put, resumePath(id), body)) as Resume;
  }

  async deleteResume(id: string): Promise<void> {
    await this.request(HttpMethod.Delete, resumePath(id));
  }

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

  async getCoverLetter(id: string): Promise<CoverLetter> {
    // Trusts the API's documented response shape; not validated at runtime.
    return (await this.request(HttpMethod.Get, letterPath(id))) as CoverLetter;
  }

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

  async trashCoverLetter(id: string, expectedRevision: number): Promise<void> {
    await this.request(HttpMethod.Delete, letterPath(id), {
      expectedRevision,
    });
  }

  async removeCoverLetter(id: string): Promise<void> {
    await this.request(HttpMethod.Delete, itemPath(LETTER_DOCUMENTS_PATH, id));
  }
}
