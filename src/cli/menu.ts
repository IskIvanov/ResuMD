/**
 * menu.ts
 *
 * Builds the tool menu from the registry: one separator heading per platform,
 * tools that can't run shown disabled with the reason, and Exit last.
 */

import {
  CliLabel,
  MenuAction,
  Platform,
  type Choice,
  type Env,
  type MenuItem,
  type ToolDefinition,
} from "./types.ts";

/** A menu entry's value: the tool to run, or a non-tool action. */
export type MenuValue = ToolDefinition | MenuAction;

/** Lists a tool, disabled with the reason when its preflight fails. */
function toToolChoice(tool: ToolDefinition, env: Env): Choice<MenuValue> {
  const choice: Choice<MenuValue> = {
    name: `${tool.title} — ${tool.description}`,
    value: tool,
  };
  const reason = tool.preflight?.(env);
  return reason
    ? { ...choice, disabled: `${CliLabel.Unavailable}: ${reason}` }
    : choice;
}

/**
 * Builds the select choices for the tool menu.
 *
 * @param tools - The registered tools; never reordered in place.
 * @param env - Passed to each tool's preflight.
 * @returns Platforms in `Platform` order, each with a separator heading and
 *   its tools in registry order, then an Exit entry. Platforms with no tools
 *   are left out.
 *
 * @example
 * buildMenu([syncTool], process.env);
 * // [{ separator: "── Site ──" }, { name: "Sync resume — …", value: syncTool },
 * //  { name: "Exit", value: MenuAction.Exit }]
 */
export function buildMenu(
  tools: readonly ToolDefinition[],
  env: Env,
): MenuItem<MenuValue>[] {
  const groups = Object.values(Platform).flatMap((platform) => {
    const members = tools.filter((tool) => tool.platform === platform);
    if (members.length === 0) return [];
    return [
      { separator: `── ${platform} ──` },
      ...members.map((tool) => toToolChoice(tool, env)),
    ];
  });

  return [...groups, { name: CliLabel.Exit, value: MenuAction.Exit }];
}
