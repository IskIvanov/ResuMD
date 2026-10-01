import { describe, it, expect } from "vitest";
import { resolve } from "path";
import { parseToolArgs } from "./define-tool.ts";
import {
  createDefinedStub,
  CWD,
  runContext,
  STUB_USAGE,
  stubSpecs,
} from "./mocks.ts";

describe("parseToolArgs", () => {
  it("resolves paths from cwd and fills defaults from earlier values", () => {
    expect(
      parseToolArgs(
        stubSpecs,
        ["--resume", "resume/Resume.md", "--name", "Jane Doe"],
        CWD,
        STUB_USAGE,
      ),
    ).toEqual({
      resume: resolve(CWD, "resume/Resume.md"),
      name: "Jane Doe",
      slug: "jane doe",
      tags: [],
    });
  });

  it("keeps a given value over its default and splits a list", () => {
    const values = parseToolArgs(
      stubSpecs,
      [
        "--resume",
        "/abs/Resume.md",
        "--name",
        "Jane",
        "--slug",
        "jd",
        "--tags",
        "a, b,",
      ],
      CWD,
      STUB_USAGE,
    );

    expect(values).toMatchObject({
      resume: "/abs/Resume.md",
      slug: "jd",
      tags: ["a", "b"],
    });
  });

  it("throws the usage when a required flag is missing", () => {
    expect(() =>
      parseToolArgs(stubSpecs, ["--resume", "r.md"], CWD, STUB_USAGE),
    ).toThrow(`--name <name> is required\n${STUB_USAGE}`);
  });

  it("throws on an unknown flag", () => {
    expect(() =>
      parseToolArgs(
        stubSpecs,
        ["--resume", "r.md", "--name", "Jane", "--nope", "x"],
        CWD,
        STUB_USAGE,
      ),
    ).toThrow();
  });
});

describe("defineTool", () => {
  it("builds the command and usage line from the options", () => {
    const { tool } = createDefinedStub();

    expect(tool.command).toBe("bun run cli stub");
    expect(tool.usage).toBe(STUB_USAGE);
  });

  it("runs with the parsed values and the run context", async () => {
    const { tool, runs } = createDefinedStub();

    await tool.run(["--resume", "r.md", "--name", "Jane"], runContext);

    expect(runs).toEqual([
      {
        values: {
          resume: resolve(CWD, "r.md"),
          name: "Jane",
          slug: "jane",
          tags: [],
        },
        context: runContext,
      },
    ]);
  });
});
