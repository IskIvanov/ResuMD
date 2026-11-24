/**
 * index.ts
 *
 * The tools that need no platform and work on Resume.md alone. Their list,
 * RESUME_MD_TOOLS, is spread into the registry in src/cli/index.ts.
 */

import { CLI_COMMAND, defineTool } from "../cli/define-tool.ts";
import {
  FileExtension,
  OptionKind,
  type OptionSpecs,
  type ToolDefinition,
  type ToolSpec,
} from "../cli/types.ts";
import { EXAMPLE_RESUME_MD } from "./example.ts";

const exampleResumeOptions = {
  output: {
    question: "Path to save Resume.md to",
    kind: OptionKind.Path,
    path: { extensions: [FileExtension.Markdown], mustExist: false },
    required: false,
    default: () => "Resume.md",
  },
} satisfies OptionSpecs;

type RunExampleResume = ToolSpec<typeof exampleResumeOptions>["run"];

const runExampleResume: RunExampleResume = async (
  { output },
  dependencies,
) => {
  if (dependencies.exists(output)) {
    throw new Error(
      `${output} already exists. Pass --output to write the example ` +
        "somewhere else, or move that file first.",
    );
  }
  dependencies.writeFile(output, new TextEncoder().encode(EXAMPLE_RESUME_MD));
  dependencies.log(
    `✓ Wrote an example Resume.md to ${output}. Replace Jane Doe's ` +
      `details with yours, then run \`${CLI_COMMAND}\` to connect a platform.`,
  );
};

/** Writes Jane Doe's Resume.md for a person to fill in with their own details. */
export const exampleResumeTool = defineTool({
  id: "example-resume",
  title: "Example resume",
  description: "write a Resume.md to fill in",
  options: exampleResumeOptions,
  run: runExampleResume,
});

/** The tools that need no platform, in menu order. */
export const RESUME_MD_TOOLS: readonly ToolDefinition[] = [exampleResumeTool];
