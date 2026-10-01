/**
 * registry.ts
 *
 * Every tool the CLI offers, in menu order. To add one, append the
 * defineTool result from src/cli/tools/<tool>.ts.
 */

import { deleteTool } from "./tools/delete-rx-resume.ts";
import { generateTool } from "./tools/generate-rx-resume.ts";
import { updateTool } from "./tools/update-rx-resume.ts";
import type { ToolDefinition } from "./types.ts";

export const TOOLS: readonly ToolDefinition[] = [
  generateTool,
  updateTool,
  deleteTool,
];
