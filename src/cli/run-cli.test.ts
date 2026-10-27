import { describe, it, expect } from "vitest";
import { runCli } from "./run-cli.ts";
import {
  createCancellingPrompter,
  createCliHarness,
  fullEnv,
  runGenerateScript,
  withRecordedRuns,
} from "./mocks.ts";
import { deleteCoverLetterTool } from "./tools/delete-cover-letter.ts";
import { generateTool } from "./tools/generate-rx-resume.ts";
import { CliLabel, ExitCode } from "./types.ts";

describe("runCli", () => {
  it("prints each tool's usage and fails without a terminal", async () => {
    const { deps, errors } = createCliHarness(
      [generateTool],
      {},
      { isTTY: false },
    );

    expect(await runCli(deps)).toBe(ExitCode.Failure);
    expect(errors.join("\n")).toContain(generateTool.usage);
  });

  it("exits cleanly when Exit is picked", async () => {
    const { tool, calls } = withRecordedRuns(generateTool);
    const { deps } = createCliHarness([tool], {
      [CliLabel.PickTool]: CliLabel.Exit,
    });

    expect(await runCli(deps)).toBe(ExitCode.Success);
    expect(calls).toEqual([]);
  });

  it("prints the command and runs the tool with the answers", async () => {
    const { tool, calls } = withRecordedRuns(generateTool);
    const { deps, output } = createCliHarness([tool], runGenerateScript, {
      env: fullEnv,
    });

    expect(await runCli(deps)).toBe(ExitCode.Success);
    expect(output).toContain(
      'bun run cli generate-rx-resume --resume resume/Resume.md --name "Jane Doe"',
    );
    expect(calls).toEqual([
      ["--resume", "resume/Resume.md", "--name", "Jane Doe"],
    ]);
  });

  it("prints the error and fails when the tool throws", async () => {
    // Without .env the tool stops at its config check, before any request.
    const { deps, errors } = createCliHarness(
      [deleteCoverLetterTool],
      {},
      { argv: ["delete-cover-letter", "--id", "letter-1"] },
    );

    expect(await runCli(deps)).toBe(ExitCode.Failure);
    expect(errors).toEqual([
      expect.stringContaining("Missing RXRESUME_API_KEY"),
    ]);
  });

  it("runs the tool named by the first argument, without the menu", async () => {
    const { tool, calls } = withRecordedRuns(generateTool);
    const { deps } = createCliHarness(
      [tool],
      {},
      {
        argv: ["generate-rx-resume", "--resume", "cv.md", "--name", "Jane"],
        isTTY: false,
      },
    );

    expect(await runCli(deps)).toBe(ExitCode.Success);
    expect(calls).toEqual([["--resume", "cv.md", "--name", "Jane"]]);
  });

  it("lists every tool's usage and fails for an unknown tool", async () => {
    const { tool, calls } = withRecordedRuns(generateTool);
    const { deps, errors } = createCliHarness([tool], {}, { argv: ["nope"] });

    expect(await runCli(deps)).toBe(ExitCode.Failure);
    expect(errors.join("\n")).toContain(`${CliLabel.UnknownTool} "nope"`);
    expect(errors.join("\n")).toContain(tool.usage);
    expect(calls).toEqual([]);
  });

  it("prints Cancelled and exits 130 on Ctrl+C", async () => {
    const { deps, errors } = createCliHarness(
      [generateTool],
      {},
      { prompter: createCancellingPrompter() },
    );

    expect(await runCli(deps)).toBe(ExitCode.Cancelled);
    expect(errors).toEqual([CliLabel.Cancelled]);
  });
});
