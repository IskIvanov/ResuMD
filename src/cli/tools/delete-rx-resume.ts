/**
 * delete-rx-resume.ts
 *
 * Permanently deletes a resume in Reactive Resume via its API, by the id that
 * generate-rx-resume prints. The API also removes its screenshots and PDFs,
 * and rejects a locked resume.
 */

import { createRxResumeClient } from "../../rx-resume/client.ts";
import { apiConfigProblem, resolveApiConfig } from "../../rx-resume/config.ts";
import type { Env, RxResumeClientConfig } from "../../rx-resume/types.ts";
import { defineTool } from "../define-tool.ts";
import { OptionKind, Platform } from "../types.ts";

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

// The Reactive Resume API does not return any data on deletion, so we just print the id.
const runDeleteClient = async (id: string, env: Env): Promise<void> => {
  const config: RxResumeClientConfig = {
    ...resolveApiConfig(env),
    fetch: globalThis.fetch,
  }
  const client = createRxResumeClient(config);
  await client.deleteResume(id);
  console.log(`${DeleteLabel.Deleted} ${id}`);
}; 

export const deleteTool = defineTool({
  id: DeleteLabel.Id,
  title: DeleteLabel.Title,
  description: DeleteLabel.Description,
  platform: Platform.ReactiveResume,
  options: ToolOptions,
  preflight: apiConfigProblem,
  run: ({id}, { env }) => runDeleteClient(id, env),
});
