/**
 * client.ts
 *
 * A minimal client for Reactive Resume's REST API: the resume, cover-letter
 * and document endpoints the tools call. `fetch` is injected, so the client
 * holds no global state and is tested without a network.
 */

import { describeCaught } from "../../utils/error.ts";
import type { FetchFunction, ValueOf } from "../../utils/types.ts";
import { ResumeFormat } from "../types.ts";
import {
  type ApiCallLog,
  type ApiErrorDetails,
  type CoverLetter,
  type CreateCoverLetterRequest,
  type CreateResumeRequest,
  EnvironmentVariable,
  type Resume,
  type RxResumeClientDependencies,
  type UpdateCoverLetterRequest,
  type UpdateResumeRequest,
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

/** The kinds of document in `/documents/{type}/{id}`. */
const DocumentType = {
  Resume: "resume",
  Letter: "letter",
} as const;
type DocumentType = ValueOf<typeof DocumentType>;

/** The account the API key belongs to; the key check reads it. */
const PROFILE_PATH = "/auth/profile";
const RESUMES_PATH = "/resumes";
const COVER_LETTERS_PATH = "/cover-letters";
/** Where a document already in Trash is purged. */
const DOCUMENTS_PATH = "/documents";
/** Where the web app's editor opens a resume. */
const RESUME_EDITOR_PATH = "/builder";
/** Where the web app opens a cover letter. */
const COVER_LETTER_EDITOR_PATH = "/dashboard";

/** One or more slashes at the end of a URL. */
const TRAILING_SLASHES = /\/+$/;

/**
 * Drops the slashes at the end of a URL, so a path can be appended.
 *
 * @param url - A URL, e.g. `https://rxresu.me/`.
 * @returns The URL without slashes at its end.
 *
 * @example
 * trimTrailingSlashes("https://rxresu.me/"); // "https://rxresu.me"
 */
export function trimTrailingSlashes(url: string): string {
  return url.replace(TRAILING_SLASHES, "");
}

/** `collection/id`, with the id URL-encoded. */
function itemPath(collection: string, id: string): string {
  return `${collection}/${encodeURIComponent(id)}`;
}

/** A non-2xx response, with the API's error code when it sent one. */
class RxResumeApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, code: string | undefined, apiMessage: string) {
    let codePart = "";
    if (code) codePart = ` ${code}`;
    super(`Reactive Resume API error ${status}${codePart}: ${apiMessage}`);
    this.name = "RxResumeApiError";
    this.status = status;
    this.code = code;
  }
}

/** The status an instance answers with when it refuses the API key. */
const UNAUTHORIZED_STATUS = 401;

/** What to do when the instance refuses the API key. */
const REFUSED_KEY_HINT = "Run Connect again with a valid API key.";

/**
 * Builds an RxResumeApiError from a failed response, JSON or not. A refused
 * key also says to connect again.
 */
async function toApiError(httpResponse: Response): Promise<RxResumeApiError> {
  const responseText = await httpResponse.text();
  let errorDetails: ApiErrorDetails = {};
  try {
    const errorJson: unknown = JSON.parse(responseText);
    if (typeof errorJson === "object" && errorJson !== null) {
      errorDetails = errorJson;
    }
  } catch {
    // Not JSON (e.g. a proxy error page); fall back to the raw text.
  }
  let code: string | undefined;
  if (typeof errorDetails.code === "string") code = errorDetails.code;
  let apiMessage = responseText || httpResponse.statusText;
  if (typeof errorDetails.message === "string") {
    apiMessage = errorDetails.message;
  }
  if (httpResponse.status === UNAUTHORIZED_STATUS) {
    apiMessage = `${apiMessage}\n${REFUSED_KEY_HINT}`;
  }
  return new RxResumeApiError(httpResponse.status, code, apiMessage);
}

/** `/resumes/{id}`. */
function resumePath(id: string): string {
  return itemPath(RESUMES_PATH, id);
}

/** `/cover-letters/{id}`. */
function coverLetterPath(id: string): string {
  return itemPath(COVER_LETTERS_PATH, id);
}

/** `/documents/{type}/{id}`. */
function documentPath(type: DocumentType, id: string): string {
  return itemPath(`${DOCUMENTS_PATH}/${type}`, id);
}

/**
 * A client for the Reactive Resume resume, cover-letter and document
 * endpoints. Each method rejects with RxResumeApiError on a non-2xx response.
 *
 * @example
 * const client = new RxResumeApiClient({ apiUrl, appUrl, apiKey, fetch });
 * const id = await client.createResume({ name: "CV", slug: "cv", tags: [] });
 */
export class RxResumeApiClient {
  readonly apiUrl: string;
  readonly appUrl: string;
  readonly apiKey: string;
  readonly fetch: FetchFunction;
  readonly apiCallLog: ApiCallLog | undefined;

  /**
   * @param dependencies - The API URL (e.g. `https://rxresu.me/api/openapi`),
   *   the web app URL (e.g. `https://rxresu.me`) for links, the API key, the
   *   `fetch` to call the API with, and an optional log of every call.
   */
  constructor(dependencies: RxResumeClientDependencies) {
    this.apiUrl = trimTrailingSlashes(dependencies.apiUrl);
    this.appUrl = trimTrailingSlashes(dependencies.appUrl);
    this.apiKey = dependencies.apiKey;
    this.fetch = dependencies.fetch;
    this.apiCallLog = dependencies.apiCallLog;
  }

  /**
   * Calls one endpoint and returns the JSON it answered with, or undefined
   * for an empty answer.
   */
  async callApi(
    method: HttpMethod,
    path: string,
    requestBody?: object,
  ): Promise<unknown> {
    const httpResponse = await this.sendRequest(method, path, requestBody);
    // DELETE answers with an empty body, which httpResponse.json() rejects.
    const responseText = await httpResponse.text();
    if (!responseText) return undefined;
    return JSON.parse(responseText);
  }

  /** Calls one endpoint and returns its 2xx response, body unread. */
  async sendRequest(
    method: HttpMethod,
    path: string,
    requestBody?: object,
  ): Promise<Response> {
    const headers = new Headers({ [ApiKeyHeader]: this.apiKey });
    const endpointUrl = `${this.apiUrl}${path}`;

    let jsonBody: string | undefined;
    if (requestBody) {
      headers.set(ContentType.Header, ContentType.Json);
      jsonBody = JSON.stringify(requestBody);
    }
    const httpRequest: RequestInit = { method, headers, body: jsonBody };

    const startedAt = this.apiCallLog?.now();
    this.apiCallLog?.write(`→ ${method} ${endpointUrl}`);

    let httpResponse: Response;
    try {
      httpResponse = await this.fetch(endpointUrl, httpRequest);
    } catch (error) {
      throw new Error(
        `${method} ${endpointUrl} failed: ${describeCaught(error)}\n` +
          `Check ${EnvironmentVariable.ApiUrl} (http or https, host, port) ` +
          "and that the server is running.",
        { cause: error },
      );
    }

    if (this.apiCallLog && startedAt !== undefined) {
      const elapsedMilliseconds = Math.round(this.apiCallLog.now() - startedAt);
      this.apiCallLog.write(
        `← ${httpResponse.status} ${method} ${endpointUrl} (${elapsedMilliseconds}ms)`,
      );
    }

    if (!httpResponse.ok) throw await toApiError(httpResponse);
    return httpResponse;
  }

  /**
   * Builds the link that opens a resume in the web app's editor.
   *
   * @param resumeId - The resume's id.
   * @returns The editor URL, with the id URL-encoded.
   *
   * @example
   * client.resumeEditorUrl("abc"); // "https://rxresu.me/builder/abc"
   */
  resumeEditorUrl(resumeId: string): string {
    return itemPath(`${this.appUrl}${RESUME_EDITOR_PATH}`, resumeId);
  }

  /**
   * Builds the link that opens a cover letter in the web app.
   *
   * @param letterId - The cover letter's id.
   * @returns The letter's URL, with the id URL-encoded.
   *
   * @example
   * client.coverLetterEditorUrl("abc"); // "https://rxresu.me/dashboard/abc"
   */
  coverLetterEditorUrl(letterId: string): string {
    return itemPath(`${this.appUrl}${COVER_LETTER_EDITOR_PATH}`, letterId);
  }

  /**
   * `GET /auth/profile`, the smallest read-only call that needs the key.
   * Rejects with RxResumeApiError when the instance refuses the key.
   */
  async checkApiKey(): Promise<void> {
    await this.callApi(HttpMethod.Get, PROFILE_PATH);
  }

  /** `POST /resumes`; resolves to the new resume's id. */
  async createResume(newResume: CreateResumeRequest): Promise<string> {
    const resumeId = await this.callApi(
      HttpMethod.Post,
      RESUMES_PATH,
      newResume,
    );
    if (typeof resumeId !== "string") {
      throw new Error(
        `POST ${RESUMES_PATH}: expected a resume id, got ${JSON.stringify(resumeId)}`,
      );
    }
    return resumeId;
  }

  /** `GET /resumes/{id}`. */
  async getResume(id: string): Promise<Resume> {
    // Trusts the API's documented response shape; not validated at runtime.
    return (await this.callApi(HttpMethod.Get, resumePath(id))) as Resume;
  }

  /** `PUT /resumes/{id}`; resolves to the updated resume. */
  async updateResume(
    id: string,
    changes: UpdateResumeRequest,
  ): Promise<Resume> {
    // Trusts the API's documented response shape; not validated at runtime.
    return (await this.callApi(
      HttpMethod.Put,
      resumePath(id),
      changes,
    )) as Resume;
  }

  /** `DELETE /resumes/{id}`; moves the resume to Trash. Rejected if locked. */
  async trashResume(id: string): Promise<void> {
    await this.callApi(HttpMethod.Delete, resumePath(id));
  }

  /** `DELETE /documents/resume/{id}`; permanent, only for a resume in Trash. */
  async purgeResume(id: string): Promise<void> {
    await this.callApi(
      HttpMethod.Delete,
      documentPath(DocumentType.Resume, id),
    );
  }

  /** `POST /cover-letters`; resolves to the new letter. */
  async createCoverLetter(
    newLetter: CreateCoverLetterRequest,
  ): Promise<CoverLetter> {
    // Unlike POST /resumes, this returns the whole letter, not only its id.
    // Trusts the API's documented response shape; not validated at runtime.
    return (await this.callApi(
      HttpMethod.Post,
      COVER_LETTERS_PATH,
      newLetter,
    )) as CoverLetter;
  }

  /** `GET /cover-letters/{id}`. */
  async getCoverLetter(id: string): Promise<CoverLetter> {
    // Trusts the API's documented response shape; not validated at runtime.
    return (await this.callApi(
      HttpMethod.Get,
      coverLetterPath(id),
    )) as CoverLetter;
  }

  /**
   * `PUT /cover-letters/{id}`; resolves to the updated letter. Rejected when
   * `expectedRevision` is no longer the letter's revision.
   */
  async updateCoverLetter(
    id: string,
    changes: UpdateCoverLetterRequest,
  ): Promise<CoverLetter> {
    // Trusts the API's documented response shape; not validated at runtime.
    return (await this.callApi(
      HttpMethod.Put,
      coverLetterPath(id),
      changes,
    )) as CoverLetter;
  }

  /**
   * `DELETE /cover-letters/{id}`; moves the letter to Trash. Rejected for a
   * locked letter or a stale revision.
   */
  async trashCoverLetter(id: string, expectedRevision: number): Promise<void> {
    await this.callApi(HttpMethod.Delete, coverLetterPath(id), {
      expectedRevision,
    });
  }

  /** `DELETE /documents/letter/{id}`; permanent, only for a letter in Trash. */
  async purgeCoverLetter(id: string): Promise<void> {
    await this.callApi(
      HttpMethod.Delete,
      documentPath(DocumentType.Letter, id),
    );
  }

  /**
   * `GET /resumes/{id}/exports/{format}`; resolves to the file's bytes. Read
   * as bytes, not text: decoding a PDF, DOCX or ODT as UTF-8 corrupts it.
   */
  async downloadResume(id: string, format: ResumeFormat): Promise<Uint8Array> {
    const urlEndpoint = `${resumePath(id)}/exports/${format}`;
    const httpResponse = await this.sendRequest(HttpMethod.Get, urlEndpoint);
    return new Uint8Array(await httpResponse.arrayBuffer());
  }
}
