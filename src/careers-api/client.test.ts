import { describe, it, expect, vi } from "vitest";
import {
  createCareersClient,
  USER_AGENT,
  CareersApiError,
} from "./client.ts";
import {
  BASE_URL,
  jsonResponse,
  notFoundReply,
  testReply,
  VACANCY,
  validPayload,
} from "./mocks.ts";
import { ApplyOutcome, type FetchFn } from "./types.ts";

/** Builds a client around a fetch stub that always returns `response`. */
function setup(response: Response, baseUrl = BASE_URL) {
  const fetch = vi.fn<FetchFn>().mockResolvedValue(response);
  const client = createCareersClient({ baseUrl, fetch });
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

describe("apply", () => {
  it("POSTs the payload as JSON to {baseUrl}/{vacancy}", async () => {
    const { client, fetch } = setup(jsonResponse(testReply));
    await client.apply(VACANCY, validPayload);

    const request = firstRequest(fetch);
    expect(request.url).toBe(`${BASE_URL}/${VACANCY}`);
    expect(request.method).toBe("POST");
    expect(request.headers.get("content-type")).toBe("application/json");
    expect(request.headers.get("user-agent")).toBe(USER_AGENT);
    expect(request.body).toEqual(validPayload);
  });

  it("URL-encodes the vacancy and ignores a trailing slash", async () => {
    const { client, fetch } = setup(jsonResponse(testReply), `${BASE_URL}/`);
    await client.apply("a/b", validPayload);
    expect(firstRequest(fetch).url).toBe(`${BASE_URL}/a%2Fb`);
  });

  it("reports a 200 as a test call, with the parsed reply and the raw response", async () => {
    const { client } = setup(jsonResponse(testReply));
    await expect(client.apply(VACANCY, validPayload)).resolves.toMatchObject({
      outcome: ApplyOutcome.Tested,
      reply: testReply,
      response: { status: 200, body: JSON.stringify(testReply) },
    });
  });

  it("reports a 201 as an application, keeping a body that is not JSON", async () => {
    const { client } = setup(new Response("Created", { status: 201 }));
    const result = await client.apply(VACANCY, validPayload);

    expect(result).toMatchObject({
      outcome: ApplyOutcome.Applied,
      response: { status: 201, body: "Created" },
    });
    expect(result.reply).toBeUndefined();
  });

  it("throws CareersApiError with the status, its meaning and the full response", async () => {
    const { client } = setup(jsonResponse(notFoundReply, 404));
    const error = await client
      .apply(VACANCY, validPayload)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CareersApiError);
    expect(error).toMatchObject({
      status: 404,
      response: { status: 404, body: JSON.stringify(notFoundReply) },
      message: expect.stringMatching(/^Careers API 404 \(.*slug\)/),
    });
    expect(error).toMatchObject({
      message: expect.stringContaining(JSON.stringify(notFoundReply, null, 2)),
    });
  });

  it("names the Retry-After delay on a 429", async () => {
    const { client } = setup(
      jsonResponse({ message: "Too many" }, 429, { "retry-after": "1800" }),
    );
    const error = await client
      .apply(VACANCY, validPayload)
      .catch((e: unknown) => e);

    expect(error).toMatchObject({
      status: 429,
      retryAfter: "1800",
      message: expect.stringContaining("1800"),
    });
  });
});
