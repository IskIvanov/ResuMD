import { describe, it, expect } from "vitest";
import { buildMenu } from "./menu.ts";
import { builderTool, emptyEnv, siteTool } from "./mocks.ts";
import { CliLabel, MenuAction } from "./types.ts";

describe("buildMenu", () => {
  it("groups tools under a separator per platform, in Platform order", () => {
    const menu = buildMenu([builderTool, siteTool], emptyEnv);

    expect(menu.slice(0, 4)).toEqual([
      { separator: "── Site ──" },
      expect.objectContaining({ value: siteTool }),
      { separator: "── Reactive Resume ──" },
      expect.objectContaining({ value: builderTool }),
    ]);
  });

  it("disables a tool whose preflight returns a reason", () => {
    const menu = buildMenu([builderTool], emptyEnv);

    expect(menu[1]).toEqual(
      expect.objectContaining({
        disabled: `${CliLabel.Unavailable}: Missing API_KEY.`,
      }),
    );
  });

  it("ends with an Exit entry", () => {
    const menu = buildMenu([siteTool], emptyEnv);

    expect(menu.at(-1)).toEqual({
      name: CliLabel.Exit,
      value: MenuAction.Exit,
    });
  });
});
