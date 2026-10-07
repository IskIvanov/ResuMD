/**
 * update-cover-letter.ts
 *
 * Parses a cover-letter `.md` and rewrites an existing cover letter in
 * Reactive Resume via its API, by the id that generate-cover-letter prints.
 * A flag left out keeps the stored value. Disabled in the menu until `.env`
 * has the Reactive Resume settings.
 */

import { runUpdateCoverLetter } from "../../cover-letter/run.ts";
import { CoverLetterIdSchema } from "../../cover-letter/schema.ts";
import { apiConfigProblem } from "../../rx-resume/config.ts";
import { CoverLetterTemplate } from "../../rx-resume/types.ts";
import { camelCaseKeys } from "../../utils/record.ts";
import { defineTool } from "../define-tool.ts";
import { FileExtension, OptionKind, Platform } from "../types.ts";

enum Option {
  Id = "id",
  Letter = "letter",
  Name = "name",
  Company = "company",
  ResumeId = "resume-id",
  ApplicationId = "application-id",
  Template = "template",
}

enum UpdateLetterLabel {
  Id = "update-cover-letter",
  Title = "Update cover letter",
  Description = "rewrite an existing cover letter in Reactive Resume from a .md",
  LetterId = "Id of the cover letter to update",
  Letter = "Path to the cover letter (.md)",
  Name = "New name",
  Company = "Company it's addressed to",
  ResumeId = "Id of the resume it goes with",
  ApplicationId = "Id of the job application it's for",
  Template = "Template (stops following the resume's design)",
}

export const updateCoverLetterTool = defineTool({
  id: UpdateLetterLabel.Id,
  title: UpdateLetterLabel.Title,
  description: UpdateLetterLabel.Description,
  platform: Platform.ReactiveResume,
  options: {
    [Option.Id]: {
      message: UpdateLetterLabel.LetterId,
      kind: OptionKind.Text,
      schema: CoverLetterIdSchema,
      required: true,
    },
    [Option.Letter]: {
      message: UpdateLetterLabel.Letter,
      kind: OptionKind.Path,
      required: true,
      path: { extensions: [FileExtension.Markdown], mustExist: true },
    },
    [Option.Name]: {
      message: UpdateLetterLabel.Name,
      kind: OptionKind.Text,
      required: false,
    },
    [Option.Company]: {
      message: UpdateLetterLabel.Company,
      kind: OptionKind.Text,
      required: false,
    },
    [Option.ResumeId]: {
      message: UpdateLetterLabel.ResumeId,
      kind: OptionKind.Text,
      required: false,
    },
    [Option.ApplicationId]: {
      message: UpdateLetterLabel.ApplicationId,
      kind: OptionKind.Text,
      required: false,
    },
    [Option.Template]: {
      message: UpdateLetterLabel.Template,
      kind: OptionKind.Choice,
      required: false,
      choices: Object.values(CoverLetterTemplate),
    },
  },
  preflight: apiConfigProblem,
  // Each kebab-case flag is the camelCase option field of the same name.
  run: (values, { env }) => runUpdateCoverLetter(camelCaseKeys(values), env),
});
