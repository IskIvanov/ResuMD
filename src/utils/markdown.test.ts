import { describe, it, expect } from "vitest";
import { splitSections } from "./markdown.ts";

describe("splitSections", () => {
  it("keys each section's body by its trimmed heading", () => {
    expect(splitSections("## Summary \nHello\n## Skills\n- TS\n")).toEqual({
      Summary: "Hello",
      Skills: "- TS\n",
    });
  });

  it("leaves out text above the first heading", () => {
    expect(splitSections("# Jane\nIntro\n## Summary\nHello\n")).toEqual({
      Summary: "Hello\n",
    });
  });

  it("ignores deeper headings inside a section", () => {
    expect(splitSections("## Jobs\n### Acme\nDev\n")).toEqual({
      Jobs: "### Acme\nDev\n",
    });
  });

  it("returns no sections when there is no heading", () => {
    expect(splitSections("Just text\n")).toEqual({});
  });
});
