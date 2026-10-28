/**
 * registry.ts
 *
 * Every tool the CLI offers, in menu order. To add one, append the
 * defineTool result from src/cli/tools/<tool>.ts.
 */

import { applyTool } from "./tools/apply-job.ts";
import { decodeTool } from "./tools/decode-cv.ts";
import { deleteCoverLetterTool } from "./tools/delete-cover-letter.ts";
import { deleteTool } from "./tools/delete-rx-resume.ts";
import { encodeTool } from "./tools/encode-cv.ts";
import { generateCoverLetterTool } from "./tools/generate-cover-letter.ts";
import { generateTool } from "./tools/generate-rx-resume.ts";
import { updateCoverLetterTool } from "./tools/update-cover-letter.ts";
import { updateTool } from "./tools/update-rx-resume.ts";
import type { ToolDefinition } from "./types.ts";

export const TOOLS: readonly ToolDefinition[] = [
  generateTool,
  updateTool,
  deleteTool,
  generateCoverLetterTool,
  updateCoverLetterTool,
  deleteCoverLetterTool,
  encodeTool,
  decodeTool,
  applyTool,
];
