/**
 * update-rx-resume.ts
 *
 * Parses Resume.md and writes it into an existing resume in Reactive Resume
 * via its API, by the id that generate-rx-resume prints. Disabled in the menu
 * until `.env` has the Reactive Resume settings.
 */

import { apiConfigProblem } from "../../rx-resume/config.ts";
import { runUpdate } from "../../update-rx-resume/run.ts";
import { defineTool } from "../define-tool.ts";
import { FileExtension, OptionKind, Platform } from "../types.ts";

enum Option {
  Id = "id",
  Resume = "resume",
}

enum UpdateLabel {
  Id = "update-rx-resume",
  Title = "Update resume",
  Description = "rewrite an existing resume in Reactive Resume from Resume.md",
  ResumeId = "Id of the resume to update",
  Resume = "Path to Resume.md",
}

export const updateTool = defineTool({
  id: UpdateLabel.Id,
  title: UpdateLabel.Title,
  description: UpdateLabel.Description,
  platform: Platform.ReactiveResume,
  options: {
    [Option.Id]: {
      message: UpdateLabel.ResumeId,
      kind: OptionKind.Text,
      required: true,
    },
    [Option.Resume]: {
      message: UpdateLabel.Resume,
      kind: OptionKind.Path,
      required: true,
      path: { extensions: [FileExtension.Markdown], mustExist: true },
    },
  },
  preflight: apiConfigProblem,
  run: (options, { env }) => runUpdate(options, env),
});
