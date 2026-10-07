import { describe, it, expect } from "vitest";
import { itemPath, trimTrailingSlashes } from "./url.ts";

describe("trimTrailingSlashes", () => {
  it("drops every trailing slash and nothing else", () => {
    expect(trimTrailingSlashes("https://rx.example/api//")).toBe(
      "https://rx.example/api",
    );
    expect(trimTrailingSlashes("https://rx.example")).toBe(
      "https://rx.example",
    );
  });
});

describe("itemPath", () => {
  it("appends the URL-encoded id to the collection path", () => {
    expect(itemPath("/resumes", "a/b c")).toBe("/resumes/a%2Fb%20c");
  });
});
