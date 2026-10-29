/**
 * registry.ts
 *
 * Every tool the CLI offers, in menu order. To add a platform, spread the
 * tool list exported by src/cli/tools/<platform>/index.ts.
 */

import { RX_RESUME_TOOLS } from "./tools/rx-resume/index.ts";
import type { ToolDefinition } from "./types.ts";

export const TOOLS: readonly ToolDefinition[] = [...RX_RESUME_TOOLS];
