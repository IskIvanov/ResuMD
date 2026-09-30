/**
 * client.ts
 *
 * A minimal Reactive Resume API client for the resume endpoints. `fetch` is
 * injected, so the client holds no global state and is tested without a
 * network.
 */

import type { CreateResumeBody, Resume, UpdateResumeBody } from "./types.ts";

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
} as const;
type HttpMethod = (typeof HttpMethod)[keyof typeof HttpMethod];

const RESUMES_PATH = "/resumes";

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
}

/** A non-2xx response, with the API's error code when it sent one. */
export class RxResumeApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, code: string | undefined, message: string) {
    super(`Reactive Resume API ${status}${code ? ` ${code}` : ""}: ${message}`);
    this.name = "RxResumeApiError";
    this.status = status;
    this.code = code;
  }
}

interface ApiErrorBody {
  code?: unknown;
  message?: unknown;
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

/**
 * Creates a client for the Reactive Resume resume endpoints.
 *
 * @param config - Base URL (e.g. `https://rxresu.me/api/openapi`), API key
 *   and the `fetch` implementation to send requests with.
 * @returns The resume endpoint methods. Each rejects with RxResumeApiError on
 *   a non-2xx response.
 *
 * @example
 * const client = createRxResumeClient({ baseUrl, apiKey, fetch });
 * const id = await client.createResume({ name: "CV", slug: "cv", tags: [] });
 */
export function createRxResumeClient(
  config: RxResumeClientConfig,
): RxResumeClient {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const resumePath = (id: string): string =>
    `${RESUMES_PATH}/${encodeURIComponent(id)}`;

  async function request(
    method: HttpMethod,
    path: string,
    body?: object,
  ): Promise<unknown> {
    const headers = new Headers({ [ApiKeyHeader]: config.apiKey });
    if (body) headers.set(ContentType.Header, ContentType.Json);

    const response = await config.fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw await toApiError(response);
    return response.json();
  }

  return {
    async createResume(body: CreateResumeBody): Promise<string> {
      const id = await request(HttpMethod.Post, RESUMES_PATH, body);
      if (typeof id !== "string") {
        throw new Error(
          `POST ${RESUMES_PATH}: expected a resume id, got ${JSON.stringify(id)}`,
        );
      }
      return id;
    },

    async getResume(id: string): Promise<Resume> {
      // Trusts the API's documented response shape; not validated at runtime.
      return (await request(HttpMethod.Get, resumePath(id))) as Resume;
    },

    async updateResume(id: string, body: UpdateResumeBody): Promise<Resume> {
      // Trusts the API's documented response shape; not validated at runtime.
      return (await request(HttpMethod.Put, resumePath(id), body)) as Resume;
    },
  };
}
