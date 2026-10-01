/**
 * generate-rx-resume.ts
 *
 * Parses Resume.md and creates a new resume in Reactive Resume via its API.
 * Disabled in the menu until `.env` has the Reactive Resume settings.
 */

import { runGenerate } from "../../generate-rx-resume/run.ts";
import { slugify } from "../../generate-rx-resume/slugify.ts";
import { apiConfigProblem } from "../../rx-resume/config.ts";
import { defineTool } from "../define-tool.ts";
import { FileExtension, OptionKind, Platform } from "../types.ts";

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
  NoSlug = "Cannot derive a slug from",
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
      default: (given) => slugify(given[Option.Name] ?? ""),
    },
    [Option.Tags]: {
      message: GenerateLabel.Tags,
      kind: OptionKind.List,
      required: false,
    },
  },
  preflight: apiConfigProblem,
  run: async (options, { env }) => {
    if (!options.slug) {
      throw new Error(
        `${GenerateLabel.NoSlug} "${options.name}"; pass --${Option.Slug}`,
      );
    }
    await runGenerate(options, env);
  },
});
