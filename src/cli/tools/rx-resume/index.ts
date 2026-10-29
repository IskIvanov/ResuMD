/**
 * index.ts
 *
 * Every Reactive Resume tool, in menu order. The registry spreads this list,
 * so deleting this folder, src/rx-resume/ and that one line removes the
 * platform.
 */

import type { ToolDefinition } from "../../types.ts";
import { deleteCoverLetterTool } from "./delete-cover-letter.ts";
import { deleteTool } from "./delete-resume.ts";
import { generateCoverLetterTool } from "./generate-cover-letter.ts";
import { generateTool } from "./generate-resume.ts";
import { updateCoverLetterTool } from "./update-cover-letter.ts";
import { updateTool } from "./update-resume.ts";

export const RX_RESUME_TOOLS: readonly ToolDefinition[] = [
  generateTool,
  updateTool,
  deleteTool,
  generateCoverLetterTool,
  updateCoverLetterTool,
  deleteCoverLetterTool,
];
