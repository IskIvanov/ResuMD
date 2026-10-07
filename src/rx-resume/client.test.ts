import { describe, it, expect, vi } from "vitest";
import { ApiKeyHeader, RxResumeApiClient, RxResumeApiError } from "./client.ts";
import {
  coverLetter,
  createCoverLetterBody,
  LETTER_ID,
  LETTER_REVISION,
  updateCoverLetterBody,
} from "./mocks.ts";
import type { FetchFn, Resume, ResumeData } from "./types.ts";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_URL = "https://rx.example/api/openapi";
const API_KEY = "test-key";

const resume: Resume = {
  id: "resume-1",
  name: "Jane Doe",
  slug: "jane-doe",
  tags: [],
  isPublic: false,
  showDownloadButtons: true,
  isLocked: false,
  hasPassword: false,
  updatedAt: "2026-09-29T00:00:00.000Z",
  data: {} as ResumeData, // Contents are irrelevant to the transport tests.
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Builds a client around a fetch stub that always returns `response`. */
function setup(response: Response, baseUrl = BASE_URL) {
  const fetch = vi.fn<FetchFn>().mockResolvedValue(response);
  const client = new RxResumeApiClient({ baseUrl, apiKey: API_KEY, fetch });
  return { client, fetch };
}

/** The request the stub received on its first call. */
function firstRequest(fetch: ReturnType<typeof setup>["fetch"]) {
  const [url, init] = fetch.mock.calls[0];
  return {
    url,
    method: init?.method,
    headers: new Headers(init?.headers),
    body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
  };
}

// ─── createResume ─────────────────────────────────────────────────────────────

describe("createResume", () => {
  it("POSTs the body to /resumes with the API key", async () => {
    const { client, fetch } = setup(jsonResponse("resume-1"));
    await client.createResume({ name: "Jane", slug: "jane", tags: ["cv"] });

    const request = firstRequest(fetch);
    expect(request.url).toBe(`${BASE_URL}/resumes`);
    expect(request.method).toBe("POST");
    expect(request.headers.get(ApiKeyHeader)).toBe(API_KEY);
    expect(request.headers.get("content-type")).toBe("application/json");
    expect(request.body).toEqual({ name: "Jane", slug: "jane", tags: ["cv"] });
  });

  it("returns the id of the created resume", async () => {
    const { client } = setup(jsonResponse("resume-1"));
    await expect(
      client.createResume({ name: "Jane", slug: "jane", tags: [] }),
    ).resolves.toBe("resume-1");
  });

  it("throws when the response is not an id string", async () => {
    const { client } = setup(jsonResponse({ id: "resume-1" }));
    await expect(
      client.createResume({ name: "Jane", slug: "jane", tags: [] }),
    ).rejects.toThrow(/expected a resume id/);
  });
});

// ─── getResume ────────────────────────────────────────────────────────────────

describe("getResume", () => {
  it("GETs /resumes/{id} and returns the resume", async () => {
    const { client, fetch } = setup(jsonResponse(resume));
    await expect(client.getResume("resume-1")).resolves.toEqual(resume);

    const request = firstRequest(fetch);
    expect(request.url).toBe(`${BASE_URL}/resumes/resume-1`);
    expect(request.method).toBe("GET");
    expect(request.headers.get(ApiKeyHeader)).toBe(API_KEY);
    expect(request.body).toBeUndefined();
  });

  it("URL-encodes the id", async () => {
    const { client, fetch } = setup(jsonResponse(resume));
    await client.getResume("a/b");
    expect(firstRequest(fetch).url).toBe(`${BASE_URL}/resumes/a%2Fb`);
  });
});

// ─── updateResume ─────────────────────────────────────────────────────────────

describe("updateResume", () => {
  it("PUTs the body to /resumes/{id} and returns the resume", async () => {
    const { client, fetch } = setup(jsonResponse(resume));
    await expect(
      client.updateResume("resume-1", { name: "Renamed" }),
    ).resolves.toEqual(resume);

    const request = firstRequest(fetch);
    expect(request.url).toBe(`${BASE_URL}/resumes/resume-1`);
    expect(request.method).toBe("PUT");
    expect(request.body).toEqual({ name: "Renamed" });
  });
});

// ─── Cover letters ────────────────────────────────────────────────────────────

describe("createCoverLetter", () => {
  it("POSTs the body to /cover-letters and returns the letter", async () => {
    const { client, fetch } = setup(jsonResponse(coverLetter));
    await expect(
      client.createCoverLetter(createCoverLetterBody),
    ).resolves.toEqual(coverLetter);

    const request = firstRequest(fetch);
    expect(request.url).toBe(`${BASE_URL}/cover-letters`);
    expect(request.method).toBe("POST");
    expect(request.headers.get(ApiKeyHeader)).toBe(API_KEY);
    expect(request.body).toEqual(createCoverLetterBody);
  });
});

describe("getCoverLetter", () => {
  it("GETs /cover-letters/{id} and returns the letter", async () => {
    const { client, fetch } = setup(jsonResponse(coverLetter));
    await expect(client.getCoverLetter(LETTER_ID)).resolves.toEqual(
      coverLetter,
    );

    const request = firstRequest(fetch);
    expect(request.url).toBe(`${BASE_URL}/cover-letters/${LETTER_ID}`);
    expect(request.method).toBe("GET");
    expect(request.headers.get(ApiKeyHeader)).toBe(API_KEY);
    expect(request.body).toBeUndefined();
  });
});

describe("updateCoverLetter", () => {
  it("PUTs the body to /cover-letters/{id} and returns the letter", async () => {
    const { client, fetch } = setup(jsonResponse(coverLetter));
    await expect(
      client.updateCoverLetter(LETTER_ID, updateCoverLetterBody),
    ).resolves.toEqual(coverLetter);

    const request = firstRequest(fetch);
    expect(request.url).toBe(`${BASE_URL}/cover-letters/${LETTER_ID}`);
    expect(request.method).toBe("PUT");
    expect(request.headers.get(ApiKeyHeader)).toBe(API_KEY);
    expect(request.body).toEqual(updateCoverLetterBody);
  });
});

describe("trashCoverLetter", () => {
  it("DELETEs /cover-letters/{id} with the expected revision", async () => {
    const { client, fetch } = setup(new Response(null, { status: 200 }));
    await expect(
      client.trashCoverLetter(LETTER_ID, LETTER_REVISION),
    ).resolves.toBeUndefined();

    const request = firstRequest(fetch);
    expect(request.url).toBe(`${BASE_URL}/cover-letters/${LETTER_ID}`);
    expect(request.method).toBe("DELETE");
    expect(request.headers.get(ApiKeyHeader)).toBe(API_KEY);
    expect(request.headers.get("content-type")).toBe("application/json");
    expect(request.body).toEqual({ expectedRevision: LETTER_REVISION });
  });
});

describe("purgeCoverLetter", () => {
  it("DELETEs /documents/letter/{id} without a body", async () => {
    const { client, fetch } = setup(new Response(null, { status: 200 }));
    await expect(client.removeCoverLetter("a/b")).resolves.toBeUndefined();

    const request = firstRequest(fetch);
    expect(request.url).toBe(`${BASE_URL}/documents/letter/a%2Fb`);
    expect(request.method).toBe("DELETE");
    expect(request.headers.get(ApiKeyHeader)).toBe(API_KEY);
    expect(request.body).toBeUndefined();
  });
});

// ─── Transport ────────────────────────────────────────────────────────────────

describe("transport", () => {
  it("ignores a trailing slash on the base URL", async () => {
    const { client, fetch } = setup(jsonResponse(resume), `${BASE_URL}/`);
    await client.getResume("resume-1");
    expect(firstRequest(fetch).url).toBe(`${BASE_URL}/resumes/resume-1`);
  });

  it("throws RxResumeApiError with the API's code and message", async () => {
    const { client } = setup(
      jsonResponse(
        {
          code: "RESUME_SLUG_ALREADY_EXISTS",
          status: 400,
          message: "A resume with this slug already exists.",
        },
        400,
      ),
    );
    const error = await client
      .createResume({ name: "Jane", slug: "jane", tags: [] })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RxResumeApiError);
    expect(error).toMatchObject({
      status: 400,
      code: "RESUME_SLUG_ALREADY_EXISTS",
      message: expect.stringContaining(
        "A resume with this slug already exists.",
      ),
    });
  });

  it("throws RxResumeApiError with the status when the body is not JSON", async () => {
    const { client } = setup(new Response("Bad gateway", { status: 502 }));
    const error = await client.getResume("resume-1").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RxResumeApiError);
    expect(error).toMatchObject({ status: 502, code: undefined });
  });
});
