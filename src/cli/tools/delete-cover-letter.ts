/**
 * delete-cover-letter.ts
 *
 * Permanently deletes a cover letter in Reactive Resume via its API, by the
 * id that generate-cover-letter prints: moves it to Trash, then purges it.
 * The API rejects a locked letter.
 */

import { runDeleteCoverLetter } from "../../cover-letter/run.ts";
import { apiConfigProblem } from "../../rx-resume/config.ts";
import { defineTool } from "../define-tool.ts";
import { OptionKind, Platform } from "../types.ts";

enum Option {
  Id = "id",
}

enum DeleteLetterLabel {
  Id = "delete-cover-letter",
  Title = "Delete cover letter",
  Description = "permanently delete a cover letter in Reactive Resume via its API",
  LetterId = "Id of the cover letter to delete",
}

export const deleteCoverLetterTool = defineTool({
  id: DeleteLetterLabel.Id,
  title: DeleteLetterLabel.Title,
  description: DeleteLetterLabel.Description,
  platform: Platform.ReactiveResume,
  options: {
    [Option.Id]: {
      message: DeleteLetterLabel.LetterId,
      kind: OptionKind.Text,
      required: true,
    },
  },
  preflight: apiConfigProblem,
  run: (values, { env }) =>
    runDeleteCoverLetter({ id: values[Option.Id] }, env),
});
