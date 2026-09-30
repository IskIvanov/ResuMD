import { describe, it, expect } from "vitest";
import { resolve } from "path";
import { resolveGenerateOptions, slugify } from "./cli.ts";

const CWD = "/work/portfolio";

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

describe("resolveGenerateOptions", () => {
  it("resolves the resume path and derives the slug from the name", () => {
    expect(
      resolveGenerateOptions(
        ["--resume", "resume/Resume.md", "--name", "Jane Doe"],
        CWD,
      ),
    ).toEqual({
      resume: resolve(CWD, "resume/Resume.md"),
      name: "Jane Doe",
      slug: "jane-doe",
      tags: [],
    });
  });

  it("keeps an explicit slug and splits comma-separated tags", () => {
    const options = resolveGenerateOptions(
      [
        "--resume",
        "/abs/Resume.md",
        "--name",
        "Jane Doe",
        "--slug",
        "jane-frontend",
        "--tags",
        "frontend, 2026,",
      ],
      CWD,
    );
    expect(options.resume).toBe("/abs/Resume.md");
    expect(options.slug).toBe("jane-frontend");
    expect(options.tags).toEqual(["frontend", "2026"]);
  });

  it("throws a usage error when --resume is missing", () => {
    expect(() => resolveGenerateOptions(["--name", "Jane"], CWD)).toThrow(
      /--resume <path> is required/,
    );
  });

  it("throws a usage error when --name is missing", () => {
    expect(() => resolveGenerateOptions(["--resume", "r.md"], CWD)).toThrow(
      /--name <name> is required/,
    );
  });

  it("throws when the name has no characters usable in a slug", () => {
    expect(() =>
      resolveGenerateOptions(["--resume", "r.md", "--name", "!!!"], CWD),
    ).toThrow(/--slug/);
  });

  it("throws on unknown options", () => {
    expect(() =>
      resolveGenerateOptions(
        ["--resume", "r.md", "--name", "Jane", "--nope", "x"],
        CWD,
      ),
    ).toThrow();
  });
});
