import { describe, it, expect } from "vitest";
import { apiConfigProblem } from "../rx-resume/config.ts";
import { buildMenu } from "./menu.ts";
import { emptyEnv, fullEnv } from "./mocks.ts";
import { deleteTool } from "./tools/delete-rx-resume.ts";
import { generateTool } from "./tools/generate-rx-resume.ts";
import { CliLabel, MenuAction } from "./types.ts";

describe("buildMenu", () => {
  it("lists tools that share a platform under one separator", () => {
    const menu = buildMenu([generateTool, deleteTool], fullEnv);

    expect(menu.slice(0, 3)).toEqual([
      { separator: "── Reactive Resume ──" },
      expect.objectContaining({ value: generateTool }),
      expect.objectContaining({ value: deleteTool }),
    ]);
  });

  it("disables a tool whose preflight returns a reason", () => {
    const menu = buildMenu([generateTool], emptyEnv);

    expect(menu[1]).toEqual(
      expect.objectContaining({
        disabled: `${CliLabel.Unavailable}: ${apiConfigProblem(emptyEnv)}`,
      }),
    );
  });

  it("ends with an Exit entry", () => {
    const menu = buildMenu([generateTool], emptyEnv);

    expect(menu.at(-1)).toEqual({
      name: CliLabel.Exit,
      value: MenuAction.Exit,
    });
  });
});
