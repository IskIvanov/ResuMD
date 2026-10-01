import { describe, it, expect } from "vitest";
import { runCli } from "./run-cli.ts";
import {
  createCancellingPrompter,
  createCliHarness,
  createStubTool,
  runStubScript,
} from "./mocks.ts";
import { CliLabel, ExitCode } from "./types.ts";

describe("runCli", () => {
  it("prints each tool's usage and fails without a terminal", async () => {
    const { tool } = createStubTool();
    const { deps, errors } = createCliHarness([tool], {}, { isTTY: false });

    expect(await runCli(deps)).toBe(ExitCode.Failure);
    expect(errors.join("\n")).toContain(tool.usage);
  });

  it("exits cleanly when Exit is picked", async () => {
    const { tool, calls } = createStubTool();
    const { deps } = createCliHarness([tool], {
      [CliLabel.PickTool]: CliLabel.Exit,
    });

    expect(await runCli(deps)).toBe(ExitCode.Success);
    expect(calls).toEqual([]);
  });

  it("prints the command and runs the tool with the answers", async () => {
    const { tool, calls } = createStubTool();
    const { deps, output } = createCliHarness([tool], runStubScript);

    expect(await runCli(deps)).toBe(ExitCode.Success);
    expect(output).toContain(
      'bun run stub --resume resume/Resume.md --name "Jane Doe"',
    );
    expect(calls).toEqual([
      ["--resume", "resume/Resume.md", "--name", "Jane Doe"],
    ]);
  });

  it("prints the error and fails when the tool throws", async () => {
    const { tool } = createStubTool({
      run: async () => {
        throw new Error("API said no");
      },
    });
    const { deps, errors } = createCliHarness([tool], runStubScript);

    expect(await runCli(deps)).toBe(ExitCode.Failure);
    expect(errors).toEqual(["API said no"]);
  });

  it("runs the tool named by the first argument, without the menu", async () => {
    const { tool, calls } = createStubTool();
    const { deps } = createCliHarness(
      [tool],
      {},
      { argv: ["stub", "--name", "Jane"], isTTY: false },
    );

    expect(await runCli(deps)).toBe(ExitCode.Success);
    expect(calls).toEqual([["--name", "Jane"]]);
  });

  it("lists every tool's usage and fails for an unknown tool", async () => {
    const { tool, calls } = createStubTool();
    const { deps, errors } = createCliHarness([tool], {}, { argv: ["nope"] });

    expect(await runCli(deps)).toBe(ExitCode.Failure);
    expect(errors.join("\n")).toContain(`${CliLabel.UnknownTool} "nope"`);
    expect(errors.join("\n")).toContain(tool.usage);
    expect(calls).toEqual([]);
  });

  it("prints Cancelled and exits 130 on Ctrl+C", async () => {
    const { tool } = createStubTool();
    const { deps, errors } = createCliHarness(
      [tool],
      {},
      { prompter: createCancellingPrompter() },
    );

    expect(await runCli(deps)).toBe(ExitCode.Cancelled);
    expect(errors).toEqual([CliLabel.Cancelled]);
  });
});
