/**
 * encode-cv.ts
 *
 * Encodes a CV as base64, the form the careers API takes in its `cv` field,
 * and checks that it decodes back to the same bytes.
 */

import { runEncode } from "../../cv-base64/run.ts";
import { defineTool } from "../define-tool.ts";
import { FileExtension, OptionKind, Platform } from "../types.ts";

const Option = {
  Cv: "cv",
  Out: "out",
} as const;

enum EncodeLabel {
  Id = "encode-cv",
  Title = "Encode CV",
  Description = "encode a CV as base64 and check it decodes back",
  Cv = "Path to the CV (.pdf, .docx or .md)",
  Out = "Where to write the base64 text (.txt)",
}

/** Appended to the CV's path for the default --out. */
const OUT_SUFFIX = ".base64.txt";

export const encodeTool = defineTool({
  id: EncodeLabel.Id,
  title: EncodeLabel.Title,
  description: EncodeLabel.Description,
  platform: Platform.JobApplication,
  options: {
    [Option.Cv]: {
      message: EncodeLabel.Cv,
      kind: OptionKind.Path,
      required: true,
      path: {
        extensions: [
          FileExtension.Pdf,
          FileExtension.Docx,
          FileExtension.Markdown,
        ],
        mustExist: true,
      },
    },
    [Option.Out]: {
      message: EncodeLabel.Out,
      kind: OptionKind.Path,
      required: false,
      default: (answers) => `${answers[Option.Cv] ?? ""}${OUT_SUFFIX}`,
      path: { extensions: [FileExtension.Text], mustExist: false },
    },
  },
  run: async (options, { cwd }) => runEncode(options, cwd),
});
