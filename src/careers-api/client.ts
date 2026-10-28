/**
 * client.ts
 *
 * A minimal client for a careers API: one endpoint that takes a job
 * application. `fetch` is injected, so the client holds no global state and
 * is tested without a network.
 */

import { formatApiResponse, parseJson } from "./response.ts";
import { ApplicationResponseSchema } from "./schema.ts";
import {
  ApplyOutcome,
  type ApiResponse,
  type ApplicationPayload,
  type ApplicationResponse,
  type ApplicationResult,
  type CareersClient,
  type CareersClientConfig,
} from "./types.ts";

/**
 * Sent as the User-Agent. The recruiter's note on an API application names
 * the client it came from.
 */
export const USER_AGENT = "resume-tools";

const Header = {
  ContentType: "content-type",
  UserAgent: "user-agent",
  RetryAfter: "retry-after",
} as const;

const JSON_CONTENT_TYPE = "application/json";
const POST = "POST";

const HttpStatus = {
  Created: 201,
  BadRequest: 400,
  NotFound: 404,
  PayloadTooLarge: 413,
  TooManyRequests: 429,
  BadGateway: 502,
} as const;

/** What each documented error status means, from the API docs. */
const StatusMeaning: Readonly<Record<number, string>> = {
  [HttpStatus.BadRequest]: "invalid JSON or a field the API rejected",
  [HttpStatus.NotFound]: "no vacancy with this slug",
  [HttpStatus.PayloadTooLarge]: "request too large, CV included",
  [HttpStatus.TooManyRequests]: "too many calls; wait before trying again",
  [HttpStatus.BadGateway]:
    "the recruitment system did not accept the application",
};

/**
 * A non-2xx response. Its message names what the status means and when to
 * retry, then prints the full response.
 */
export class CareersApiError extends Error {
  readonly status: number;
  /** The Retry-After header, sent with a 429. */
  readonly retryAfter: string | undefined;
  /** The whole response, as the API sent it. */
  readonly response: ApiResponse;

  constructor(response: ApiResponse, retryAfter: string | undefined) {
    const meaning = StatusMeaning[response.status];
    const wait = retryAfter ? `. Retry-After: ${retryAfter}` : "";
    super(
      `Careers API ${response.status}${meaning ? ` (${meaning})` : ""}${wait}\n` +
        formatApiResponse(response),
    );
    this.name = "CareersApiError";
    this.status = response.status;
    this.retryAfter = retryAfter;
    this.response = response;
  }
}

/** Reads the status line and the whole body; a body can be read only once. */
async function readResponse(response: Response): Promise<ApiResponse> {
  return {
    status: response.status,
    statusText: response.statusText,
    body: await response.text(),
  };
}

/** Reads a success reply; undefined when it isn't the documented shape. */
function parseReply(text: string): ApplicationResponse | undefined {
  const result = ApplicationResponseSchema.safeParse(parseJson(text));
  return result.success ? result.data : undefined;
}

/**
 * Creates a client for a careers API.
 *
 * @param config - The apply endpoint without a vacancy (e.g.
 *   `https://careers.example.com/api/apply`) and the `fetch` to send with.
 * @returns The `apply` method. It rejects with CareersApiError on a non-2xx
 *   response.
 *
 * @example
 * const client = createCareersClient({ baseUrl, fetch });
 * const { outcome } = await client.apply("software-engineer", payload);
 */
export function createCareersClient(
  config: CareersClientConfig,
): CareersClient {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");

  return {
    async apply(
      vacancy: string,
      payload: ApplicationPayload,
    ): Promise<ApplicationResult> {
      const response = await config.fetch(
        `${baseUrl}/${encodeURIComponent(vacancy)}`,
        {
          method: POST,
          headers: {
            [Header.ContentType]: JSON_CONTENT_TYPE,
            [Header.UserAgent]: USER_AGENT,
          },
          body: JSON.stringify(payload),
        },
      );
      const raw = await readResponse(response);
      if (!response.ok) {
        const retryAfter = response.headers.get(Header.RetryAfter) ?? undefined;
        throw new CareersApiError(raw, retryAfter);
      }

      // The status, not the body, says whether anything was saved: the docs
      // define 200 as a test call and 201 as an accepted application.
      return {
        outcome:
          raw.status === HttpStatus.Created
            ? ApplyOutcome.Applied
            : ApplyOutcome.Tested,
        reply: parseReply(raw.body),
        response: raw,
      };
    },
  };
}
