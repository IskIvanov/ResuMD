/**
 * generate-cover-letter.ts
 *
 * Parses a cover-letter `.md` and creates a cover letter in Reactive Resume
 * via its API, linked to a resume for its sender details and design.
 * Disabled in the menu until `.env` has the Reactive Resume settings.
 */

import { runGenerateCoverLetter } from "../../cover-letter/run.ts";
import { apiConfigProblem } from "../../rx-resume/config.ts";
import { CoverLetterTemplate } from "../../rx-resume/types.ts";
import { camelCaseKeys } from "../../utils/record.ts";
import { defineTool } from "../define-tool.ts";
import { FileExtension, OptionKind, Platform } from "../types.ts";

enum Option {
  Letter = "letter",
  Name = "name",
  ResumeId = "resume-id",
  ApplicationId = "application-id",
  Company = "company",
  Template = "template",
}

enum GenerateLetterLabel {
  Id = "generate-cover-letter",
  Title = "Generate cover letter",
  Description = "create a cover letter in Reactive Resume from a .md",
  Letter = "Path to the cover letter (.md)",
  Name = "Name of the new cover letter",
  ResumeId = "Id of the resume it goes with (gives the sender and design)",
  ApplicationId = "Id of the job application it's for",
  Company = "Company it's addressed to",
  Template = "Template (leave out to follow the resume's design)",
}

export const generateCoverLetterTool = defineTool({
  id: GenerateLetterLabel.Id,
  title: GenerateLetterLabel.Title,
  description: GenerateLetterLabel.Description,
  platform: Platform.ReactiveResume,
  options: {
    [Option.Letter]: {
      message: GenerateLetterLabel.Letter,
      kind: OptionKind.Path,
      required: true,
      path: { extensions: [FileExtension.Markdown], mustExist: true },
    },
    [Option.Name]: {
      message: GenerateLetterLabel.Name,
      kind: OptionKind.Text,
      required: true,
    },
    [Option.ResumeId]: {
      message: GenerateLetterLabel.ResumeId,
      kind: OptionKind.Text,
      required: true,
    },
    [Option.ApplicationId]: {
      message: GenerateLetterLabel.ApplicationId,
      kind: OptionKind.Text,
      required: false,
    },
    [Option.Company]: {
      message: GenerateLetterLabel.Company,
      kind: OptionKind.Text,
      required: false,
    },
    [Option.Template]: {
      message: GenerateLetterLabel.Template,
      kind: OptionKind.Choice,
      required: false,
      choices: Object.values(CoverLetterTemplate),
    },
  },
  preflight: apiConfigProblem,
  // Each kebab-case flag is the camelCase option field of the same name.
  run: (values, { env }) => runGenerateCoverLetter(camelCaseKeys(values), env),
});
