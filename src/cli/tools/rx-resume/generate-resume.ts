/**
 * generate-resume.ts
 *
 * Parses Resume.md and creates a new resume in Reactive Resume via its API.
 * Disabled in the menu until `.env` has the Reactive Resume settings.
 */

import { readFileSync } from "fs";
import { rxResumeProblem } from "../../../rx-resume/index.ts";
import { slugify } from "../../../utils/string.ts";
import { defineTool } from "../../define-tool.ts";
import { CliError } from "../../errors.ts";
import {
  CliErrorCode,
  FileExtension,
  OptionKind,
  Platform,
} from "../../types.ts";
import { connect } from "./connect.ts";
import { printResume } from "./print.ts";

const UTF8 = "utf-8";

const Option = {
  Resume: "resume",
  Name: "name",
  Slug: "slug",
  Tags: "tags",
} as const;

enum GenerateLabel {
  Id = "generate-rx-resume",
  Title = "Generate resume",
  Description = "create a new resume in Reactive Resume via its API",
  Resume = "Path to Resume.md",
  Name = "Name of the new resume",
  Slug = "URL slug (must be unused)",
  Tags = "Tags, comma-separated",
  Created = "✓ Created",
}

export const generateTool = defineTool({
  id: GenerateLabel.Id,
  title: GenerateLabel.Title,
  description: GenerateLabel.Description,
  platform: Platform.ReactiveResume,
  options: {
    [Option.Resume]: {
      message: GenerateLabel.Resume,
      kind: OptionKind.Path,
      required: true,
      path: { extensions: [FileExtension.Markdown], mustExist: true },
    },
    [Option.Name]: {
      message: GenerateLabel.Name,
      kind: OptionKind.Text,
      required: true,
    },
    [Option.Slug]: {
      message: GenerateLabel.Slug,
      kind: OptionKind.Text,
      required: false,
      default: (answers) => slugify(answers[Option.Name] ?? ""),
    },
    [Option.Tags]: {
      message: GenerateLabel.Tags,
      kind: OptionKind.List,
      required: false,
    },
  },
  preflight: rxResumeProblem,
  run: async ({ resume, name, slug, tags }, { env }) => {
    if (!slug) {
      throw new CliError({
        code: CliErrorCode.UnderivableDefault,
        flag: Option.Slug,
        source: name,
      });
    }
    // Settings are checked before the file is read.
    const rx = connect(env);
    const markdown = readFileSync(resume, UTF8);
    const result = await rx.resumes.generate({
      markdown,
      name,
      slug,
      tags,
    });
    printResume(GenerateLabel.Created, result);
  },
});
