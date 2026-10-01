import { describe, it, expect } from "vitest";
import { pathSchema, toValidator } from "./schema.ts";
import { markdownRule, pathContext } from "./mocks.ts";

describe("pathSchema", () => {
  const validate = toValidator(pathSchema(markdownRule, pathContext));

  it("accepts an existing file with a supported extension", () => {
    expect(validate("resume/Resume.md")).toBe(true);
  });

  it("rejects an unsupported extension", () => {
    expect(validate("Resume.cp")).toBe(
      'Unsupported format ".cp" — expected .md',
    );
  });

  it("rejects a missing file", () => {
    expect(validate("nope.md")).toBe("File not found: nope.md");
  });
});
