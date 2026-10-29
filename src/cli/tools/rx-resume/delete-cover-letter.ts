/**
 * delete-cover-letter.ts
 *
 * Permanently deletes a cover letter in Reactive Resume via its API, by the
 * id that generate-cover-letter prints: moves it to Trash, then purges it.
 * The API rejects a locked letter.
 */

import {
  CoverLetterIdSchema,
  rxResumeProblem,
} from "../../../rx-resume/index.ts";
import { defineTool } from "../../define-tool.ts";
import { OptionKind, Platform } from "../../types.ts";
import { connect } from "./connect.ts";

enum Option {
  Id = "id",
}

enum DeleteLetterLabel {
  Id = "delete-cover-letter",
  Title = "Delete cover letter",
  Description = "permanently delete a cover letter in Reactive Resume via its API",
  LetterId = "Id of the cover letter to delete",
  Deleted = "✓ Permanently deleted cover letter",
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
      schema: CoverLetterIdSchema,
      required: true,
    },
  },
  preflight: rxResumeProblem,
  run: async ({ id }, { env }) => {
    await connect(env).coverLetters.delete(id);
    console.log(`${DeleteLetterLabel.Deleted} ${id}`);
  },
});
