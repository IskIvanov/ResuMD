/**
 * decode-cv.ts
 *
 * Decodes a base64 text file back into a CV, so you can open it and see
 * exactly what an API would receive. Never overwrites an existing file.
 */

import { runDecode } from "../../cv-base64/run.ts";
import { defineTool } from "../define-tool.ts";
import { FileExtension, OptionKind, Platform } from "../types.ts";

const Option = {
  Base64: "base64",
  Out: "out",
} as const;

enum DecodeLabel {
  Id = "decode-cv",
  Title = "Decode CV",
  Description = "decode base64 text back into a CV to open and check",
  Base64 = "Path to the base64 text (.txt)",
  Out = "Where to write the decoded CV (.pdf, .docx or .md; must not exist)",
}

export const decodeTool = defineTool({
  id: DecodeLabel.Id,
  title: DecodeLabel.Title,
  description: DecodeLabel.Description,
  platform: Platform.JobApplication,
  options: {
    [Option.Base64]: {
      message: DecodeLabel.Base64,
      kind: OptionKind.Path,
      required: true,
      path: { extensions: [FileExtension.Text], mustExist: true },
    },
    [Option.Out]: {
      message: DecodeLabel.Out,
      kind: OptionKind.Path,
      required: true,
      path: {
        extensions: [
          FileExtension.Pdf,
          FileExtension.Docx,
          FileExtension.Markdown,
        ],
        mustExist: false,
      },
    },
  },
  run: async (options, { cwd }) => runDecode(options, cwd),
});
