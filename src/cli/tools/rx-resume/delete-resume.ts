/**
 * delete-resume.ts
 *
 * Permanently deletes a resume in Reactive Resume via its API, by the id that
 * generate-rx-resume prints. The API also removes its screenshots and PDFs,
 * and rejects a locked resume.
 */

import { rxResumeProblem } from "../../../rx-resume/index.ts";
import { defineTool } from "../../define-tool.ts";
import { OptionKind, Platform } from "../../types.ts";
import { connect } from "./connect.ts";

enum Option {
  Id = "id",
}

enum DeleteLabel {
  Id = "delete-rx-resume",
  Title = "Delete resume",
  Description = "permanently delete a resume in Reactive Resume via its API",
  ResumeId = "Id of the resume to delete",
  Deleted = "✓ Deleted resume",
}

const ToolOptions = {
  [Option.Id]: {
    message: DeleteLabel.ResumeId,
    kind: OptionKind.Text,
    required: true,
  },
} as const;

export const deleteTool = defineTool({
  id: DeleteLabel.Id,
  title: DeleteLabel.Title,
  description: DeleteLabel.Description,
  platform: Platform.ReactiveResume,
  options: ToolOptions,
  preflight: rxResumeProblem,
  // The API returns no data on deletion, so only the id is printed.
  run: async ({ id }, { env }) => {
    await connect(env).resumes.delete(id);
    console.log(`${DeleteLabel.Deleted} ${id}`);
  },
});
