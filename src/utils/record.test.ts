import { describe, it, expect, expectTypeOf } from "vitest";
import {
  camelCaseKeys,
  fillDefaults,
  omitUndefined,
  pickNonEmptyStrings,
} from "./record.ts";

describe("omitUndefined", () => {
  it("drops undefined fields and keeps every other value", () => {
    expect(
      omitUndefined({ a: "x", b: undefined, c: 0, d: null, e: "" }),
    ).toEqual({ a: "x", c: 0, d: null, e: "" });
  });
});

describe("pickNonEmptyStrings", () => {
  it("keeps only the entries that are non-empty strings", () => {
    expect(
      pickNonEmptyStrings({ a: "x", b: "", c: undefined, d: true, e: ["y"] }),
    ).toEqual({ a: "x" });
  });
});

describe("fillDefaults", () => {
  it("fills missing keys in order, each default seeing the ones before it", () => {
    expect(
      fillDefaults({ name: "Jane" }, [
        ["name", () => "ignored"],
        ["slug", (known) => known.name.toLowerCase()],
        ["path", (known) => `/${known.slug}`],
        ["tags", undefined],
      ]),
    ).toEqual({ name: "Jane", slug: "jane", path: "/jane" });
  });

  it("leaves a key out when its default builds nothing", () => {
    expect(fillDefaults({}, [["slug", () => undefined]])).toEqual({});
  });
});

describe("camelCaseKeys", () => {
  it("renames kebab-case keys to camelCase, keeping each value's type", () => {
    const fields = camelCaseKeys({ "resume-id": "r1", company: undefined });

    expect(fields).toEqual({ resumeId: "r1", company: undefined });
    expectTypeOf(fields).toEqualTypeOf<{
      resumeId: string;
      company: undefined;
    }>();
  });
});
