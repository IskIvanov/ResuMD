import { describe, it, expect } from "vitest";
import { z } from "zod";
import { parseOrThrow, requiredText, FieldProblem } from "./schema.ts";

describe("requiredText", () => {
  it("accepts a non-empty string", () => {
    expect(requiredText.parse("x")).toBe("x");
  });

  it.each([undefined, ""])("reports %j as required", (value) => {
    const result = requiredText.safeParse(value);
    expect(result.error?.issues[0]?.message).toBe(FieldProblem.Required);
  });
});

describe("parseOrThrow", () => {
  const schema = z.object({
    name: requiredText,
    tags: z.array(z.string()).min(1, FieldProblem.Empty),
  });

  it("returns the parsed value when it matches", () => {
    expect(parseOrThrow(schema, { name: "a", tags: ["b"] }, "Bad:")).toEqual({
      name: "a",
      tags: ["b"],
    });
  });

  it("writes a nested path as code does: keys dotted, indices bracketed", () => {
    const jobs = z.object({ jobs: z.array(z.object({ role: requiredText })) });

    expect(() =>
      parseOrThrow(jobs, { jobs: [{ role: "a" }, { role: "" }] }, "Bad:"),
    ).toThrow("Bad:\n  jobs[1].role: required");
  });

  it("lists every failure with its path under the heading", () => {
    expect(() => parseOrThrow(schema, { tags: [] }, "Bad:")).toThrow(
      "Bad:\n  name: required\n  tags: needs at least one entry",
    );
  });
});
