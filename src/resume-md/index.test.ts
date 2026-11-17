import { describe, expect, it } from "vitest";
import { relative } from "path";
import type { ToolDependencies, ToolDefinition } from "../cli/types.ts";
import { exampleResumeTool } from "./index.ts";
import { parseResumeMd } from "./parser.ts";

// ─── Running a tool ───────────────────────────────────────────────────────────

const WORKING_DIRECTORY = "/work";

/** Fails the test that reaches it: these tools never call the outside world. */
function unreachable(): never {
  throw new Error("A Resume.md tool reached the outside world");
}

/** What a tool printed, and the files it saved as text, by path relative to WORKING_DIRECTORY. */
interface ToolOutput {
  output: string[];
  savedFiles: Record<string, string>;
}

/**
 * Runs a tool from WORKING_DIRECTORY with its tool arguments, as
 * `bun run cli <id> …` would, against an in-memory file system.
 *
 * @param tool - A registered tool.
 * @param toolArguments - Its flags.
 * @param files - The files already there, by path relative to
 *   WORKING_DIRECTORY.
 * @param savedFiles - The record the saved files are written into, to read
 *   even when the tool throws.
 * @returns The lines it printed and the files it saved.
 * @throws Whatever the tool throws.
 */
async function runTool(
  tool: ToolDefinition,
  toolArguments: readonly string[],
  files: Record<string, string> = {},
  savedFiles: Record<string, string> = {},
): Promise<ToolOutput> {
  const printed: ToolOutput = { output: [], savedFiles };
  const dependencies: ToolDependencies = {
    workingDirectory: WORKING_DIRECTORY,
    environmentVariables: {},
    fetch: unreachable,
    newId: unreachable,
    today: unreachable,
    now: unreachable,
    readFile: unreachable,
    exists: (path) => relative(WORKING_DIRECTORY, path) in files,
    writeFile: (path, bytes) => {
      printed.savedFiles[relative(WORKING_DIRECTORY, path)] =
        new TextDecoder().decode(bytes);
    },
    settingsFile: "/home/jane/.config/resume-tools/.env",
    writePrivateFile: unreachable,
    log: (line) => printed.output.push(line),
    logError: unreachable,
  };
  await tool.run(toolArguments, dependencies);
  return printed;
}

// ─── example-resume ───────────────────────────────────────────────────────────

describe("example-resume", () => {
  it("writes Jane Doe's Resume.md into the working directory, as the parser reads it", async () => {
    const { savedFiles } = await runTool(exampleResumeTool, []);

    expect(parseResumeMd(savedFiles["Resume.md"] ?? "").header.name).toBe(
      "Jane Doe",
    );
  });

  it("writes to the path given with --output", async () => {
    const { savedFiles } = await runTool(exampleResumeTool, [
      "--output",
      "cv/My Resume.md",
    ]);

    expect(Object.keys(savedFiles)).toEqual(["cv/My Resume.md"]);
  });

  it("says where it wrote the example and what to do next", async () => {
    const { output } = await runTool(exampleResumeTool, []);

    expect(output).toEqual([
      "✓ Wrote an example Resume.md to /work/Resume.md. Replace Jane Doe's " +
        "details with yours, then run `bun run cli` to connect a platform.",
    ]);
  });

  it("refuses to overwrite an existing Resume.md, saving nothing", async () => {
    const savedFiles: Record<string, string> = {};

    await expect(
      runTool(
        exampleResumeTool,
        [],
        { "Resume.md": "# Jane Doe\n" },
        savedFiles,
      ),
    ).rejects.toThrow(
      "/work/Resume.md already exists. Pass --output to write the example " +
        "somewhere else, or move that file first.",
    );
    expect(savedFiles).toEqual({});
  });
});
