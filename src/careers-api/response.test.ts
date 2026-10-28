import { describe, it, expect } from "vitest";
import {
  emptyResponse,
  testCallResponse,
  testReply,
  textResponse,
} from "./mocks.ts";
import { formatApiResponse, parseJson, ResponseLabel } from "./response.ts";

describe("formatApiResponse", () => {
  it("puts the status line above the JSON body, pretty-printed", () => {
    expect(formatApiResponse(testCallResponse)).toBe(
      `${ResponseLabel.Heading} 200 OK\n${JSON.stringify(testReply, null, 2)}`,
    );
  });

  it("prints a body that isn't JSON as it came", () => {
    expect(formatApiResponse(textResponse)).toBe(
      `${ResponseLabel.Heading} 502 Bad Gateway\nupstream unavailable`,
    );
  });

  it("marks an empty body and leaves out empty status text", () => {
    expect(formatApiResponse(emptyResponse)).toBe(
      `${ResponseLabel.Heading} 201\n${ResponseLabel.EmptyBody}`,
    );
  });
});

describe("parseJson", () => {
  it("parses JSON", () => {
    expect(parseJson('{"ok":true}')).toEqual({ ok: true });
  });

  it("returns undefined for text that isn't JSON", () => {
    expect(parseJson("upstream unavailable")).toBeUndefined();
  });
});
