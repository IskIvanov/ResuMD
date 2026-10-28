import { describe, it, expect } from "vitest";
import { apiConfigProblem } from "../rx-resume/config.ts";
import { buildMenu } from "./menu.ts";
import { emptyEnv, fullEnv } from "./mocks.ts";
import { applyTool } from "./tools/apply-job.ts";
import { generateTool } from "./tools/generate-rx-resume.ts";
import { CliLabel, MenuAction } from "./types.ts";

describe("buildMenu", () => {
  it("groups tools under a separator per platform, in Platform order", () => {
    const menu = buildMenu([applyTool, generateTool], fullEnv);

    expect(menu.slice(0, 4)).toEqual([
      { separator: "── Reactive Resume ──" },
      expect.objectContaining({ value: generateTool }),
      { separator: "── Job Application ──" },
      expect.objectContaining({ value: applyTool }),
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
