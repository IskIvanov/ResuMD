import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  formatIssuePath,
  parseOrThrow,
  requiredText,
  ValidationMessage,
} from "./schema.ts";

describe("formatIssuePath", () => {
  it("joins keys with dots and wraps indices in brackets", () => {
    expect(formatIssuePath(["jobs", 2, "role"])).toBe("jobs[2].role");
  });

  it("formats a top-level key as-is", () => {
    expect(formatIssuePath(["summary"])).toBe("summary");
  });

  it("formats an empty path as an empty string", () => {
    expect(formatIssuePath([])).toBe("");
  });
});

describe("requiredText", () => {
  it("accepts a non-empty string", () => {
    expect(requiredText.parse("x")).toBe("x");
  });

  it.each([undefined, ""])("reports %j as required", (value) => {
    const result = requiredText.safeParse(value);
    expect(result.error?.issues[0]?.message).toBe(ValidationMessage.Required);
  });
});

describe("parseOrThrow", () => {
  const schema = z.object({
    name: requiredText,
    tags: z.array(z.string()).min(1, ValidationMessage.Empty),
  });

  it("returns the parsed value when it matches", () => {
    expect(parseOrThrow(schema, { name: "a", tags: ["b"] }, "Bad:")).toEqual({
      name: "a",
      tags: ["b"],
    });
  });

  it("lists every failure with its path under the heading", () => {
    expect(() => parseOrThrow(schema, { tags: [] }, "Bad:")).toThrow(
      "Bad:\n  name: required\n  tags: needs at least one entry",
    );
  });
});
