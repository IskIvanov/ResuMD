import { describe, it, expect, expectTypeOf } from "vitest";
import { resolve } from "path";
import { CoverLetterTemplate } from "../rx-resume/types.ts";
import { CliError } from "./errors.ts";
import { CWD, GENERATE_LETTER_ARGV, runContext } from "./mocks.ts";
import { generateCoverLetterTool } from "./tools/generate-cover-letter.ts";
import { generateTool } from "./tools/generate-rx-resume.ts";
import { CliErrorCode } from "./types.ts";

describe("parse", () => {
  it("resolves paths from cwd and fills defaults from earlier answers", () => {
    expect(
      generateTool.parse(
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

  it("keeps a given answer over its default and splits a list", () => {
    const values = generateTool.parse(
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
    );

    expect(values).toMatchObject({
      resume: "/abs/Resume.md",
      slug: "jd",
      tags: ["a", "b"],
    });
  });

  it("throws a CliError with the usage when a required flag is missing", () => {
    const parseWithoutName = () =>
      generateTool.parse(["--resume", "r.md"], CWD);

    expect(parseWithoutName).toThrow(CliError);
    expect(parseWithoutName).toThrow(
      `--name <name> is required\n${generateTool.usage}`,
    );
  });

  it("throws on an unknown flag", () => {
    expect(() =>
      generateTool.parse(
        ["--resume", "r.md", "--name", "Jane", "--nope", "x"],
        CWD,
      ),
    ).toThrow();
  });

  it("parses a choice into one of its values, typed as their union", () => {
    const values = generateCoverLetterTool.parse(
      [...GENERATE_LETTER_ARGV, "--template", "onyx"],
      CWD,
    );

    expect(values.template).toBe(CoverLetterTemplate.Onyx);
    expectTypeOf(values.template).toEqualTypeOf<
      CoverLetterTemplate | undefined
    >();
  });

  it("rejects a value that isn't one of the choices", () => {
    expect(() =>
      generateCoverLetterTool.parse(
        [...GENERATE_LETTER_ARGV, "--template", "charizard"],
        CWD,
      ),
    ).toThrow(
      expect.objectContaining({
        reason: expect.objectContaining({ code: CliErrorCode.InvalidChoice }),
        message: expect.stringContaining("--template must be one of azurill"),
      }),
    );
  });
});

describe("defineTool", () => {
  it("builds the command and usage line from the options", () => {
    expect(generateTool.command).toBe("bun run cli generate-rx-resume");
    expect(generateTool.usage).toBe(
      "Usage: bun run cli generate-rx-resume --resume <path> --name <name> [--slug <slug>] [--tags <a,b>]",
    );
  });

  it("shows a choice as <flag> in the usage line", () => {
    expect(generateCoverLetterTool.usage).toContain("[--template <template>]");
  });

  it("parses before running, so invalid flags never reach the tool", async () => {
    await expect(generateCoverLetterTool.run([], runContext)).rejects.toThrow(
      CliError,
    );
  });

  it("runs the tool with the parsed values and the run context's env", async () => {
    // The empty env stops the tool at its config check, before any request.
    await expect(
      generateCoverLetterTool.run(GENERATE_LETTER_ARGV, runContext),
    ).rejects.toThrow("Missing RXRESUME_API_KEY");
  });
});
