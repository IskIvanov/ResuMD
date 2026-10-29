import { describe, it, expect } from "vitest";
import { slugify, splitList } from "./string.ts";

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
    expect(splitList("react, vue ,svelte")).toEqual(["react", "vue", "svelte"]);
  });

  it("drops empty entries", () => {
    expect(splitList("react,, ,vue,")).toEqual(["react", "vue"]);
  });

  it("returns an empty list for an absent or empty value", () => {
    expect(splitList(undefined)).toEqual([]);
    expect(splitList("")).toEqual([]);
  });
});
