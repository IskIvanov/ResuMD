import { describe, it, expect } from "vitest";
import { slugify } from "./slugify.ts";

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
