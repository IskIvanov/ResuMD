import { describe, it, expect, expectTypeOf } from "vitest";
import { kebabToCamel, slugify, splitList } from "./string.ts";

describe("slugify", () => {
  it("lowercases and joins words with dashes", () => {
    expect(slugify("Jane Doe — Frontend 2026")).toBe("jane-doe-frontend-2026");
  });

  it("strips diacritics", () => {
    expect(slugify("Zoë Müller")).toBe("zoe-muller");
  });

  it("trims leading and trailing separators", () => {
    expect(slugify("  --Jane!  ")).toBe("jane");
  });
});

describe("splitList", () => {
  it("splits on commas and trims each entry", () => {
    expect(splitList("a, b ,c")).toEqual(["a", "b", "c"]);
  });

  it("drops empty entries", () => {
    expect(splitList("a,, ,b,")).toEqual(["a", "b"]);
  });

  it("returns an empty list for an absent or empty value", () => {
    expect(splitList(undefined)).toEqual([]);
    expect(splitList("")).toEqual([]);
  });
});

describe("kebabToCamel", () => {
  it("joins kebab-case words in camelCase, at the type level too", () => {
    const name = kebabToCamel("linkedin-profile-url");

    expect(name).toBe("linkedinProfileUrl");
    expectTypeOf(name).toEqualTypeOf<"linkedinProfileUrl">();
  });

  it("leaves a name without dashes as it is", () => {
    expect(kebabToCamel("letter")).toBe("letter");
  });
});
