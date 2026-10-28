import { describe, it, expect } from "vitest";
import { isCliError } from "./errors.ts";
import { buildMenu, type MenuValue } from "./menu.ts";
import {
  ALWAYS_AVAILABLE_TOOL_IDS,
  COVER_LETTER_TOOL_IDS,
  emptyEnv,
  fullEnv,
  MENU_LAYOUT,
  runContext,
  USAGE_BY_TOOL_ID,
} from "./mocks.ts";
import { TOOLS } from "./registry.ts";
import {
  CliErrorCode,
  CliLabel,
  type Env,
  type MenuItem,
  type ToolDefinition,
} from "./types.ts";

/** A menu entry as one line: its heading, its tool's id, or its action. */
function menuLine(item: MenuItem<MenuValue>): string {
  if ("separator" in item) return item.separator;
  if (typeof item.value === "string") return item.value;
  return item.value.id;
}

/** The tool's own menu entry, under its platform heading. */
function menuEntry(tool: ToolDefinition, env: Env): MenuItem<MenuValue> {
  return buildMenu([tool], env)[1];
}

const toolsNeedingSettings = TOOLS.filter(
  (tool) => !ALWAYS_AVAILABLE_TOOL_IDS.includes(tool.id),
);
const alwaysAvailableTools = TOOLS.filter((tool) =>
  ALWAYS_AVAILABLE_TOOL_IDS.includes(tool.id),
);

describe("TOOLS", () => {
  it("lists every tool under its platform heading, in registry order", () => {
    expect(buildMenu(TOOLS, fullEnv).map(menuLine)).toEqual(MENU_LAYOUT);
  });

  it("lists the cover-letter tools after delete-rx-resume, in order", () => {
    const ids = TOOLS.map((tool) => tool.id);
    const after = ids.indexOf("delete-rx-resume") + 1;

    expect(ids.slice(after, after + 3)).toEqual(COVER_LETTER_TOOL_IDS);
  });

  it.each(TOOLS)(
    "runs $id as `bun run cli $id` with its usage line",
    (tool) => {
      expect(tool.command).toBe(`bun run cli ${tool.id}`);
      expect(tool.usage).toBe(USAGE_BY_TOOL_ID[tool.id]);
    },
  );

  it.each(toolsNeedingSettings)(
    "disables $id until .env has its settings",
    (tool) => {
      expect(menuEntry(tool, emptyEnv)).toMatchObject({
        disabled: expect.stringContaining(CliLabel.Unavailable),
      });
      expect(menuEntry(tool, fullEnv)).not.toHaveProperty("disabled");
    },
  );

  it.each(alwaysAvailableTools)("always offers $id", (tool) => {
    expect(menuEntry(tool, emptyEnv)).not.toHaveProperty("disabled");
  });

  it.each(TOOLS)(
    "rejects $id without its required flags, before doing any work",
    async (tool) => {
      const error = await tool.run([], runContext).catch((e: unknown) => e);

      expect(isCliError(error, CliErrorCode.MissingOption)).toBe(true);
    },
  );
});
