/**
 * update-cover-letter.ts
 *
 * Parses a cover-letter `.md` and rewrites an existing cover letter in
 * Reactive Resume via its API, by the id that generate-cover-letter prints.
 * A flag left out keeps the stored value. Disabled in the menu until `.env`
 * has the Reactive Resume settings.
 */

import { readFileSync } from "fs";
import {
  CoverLetterIdSchema,
  CoverLetterTemplate,
  rxResumeProblem,
} from "../../../rx-resume/index.ts";
import { camelCaseKeys } from "../../../utils/record.ts";
import { defineTool } from "../../define-tool.ts";
import { FileExtension, OptionKind, Platform } from "../../types.ts";
import { connect } from "./connect.ts";
import { printLetter } from "./print.ts";

const UTF8 = "utf-8";

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
  Updated = "✓ Updated cover letter",
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
  preflight: rxResumeProblem,
  run: async (values, { env }) => {
    // Each kebab-case flag is the camelCase input field of the same name.
    const { letter, ...fields } = camelCaseKeys(values);
    // Settings are checked before the file is read.
    const rx = connect(env);
    const markdown = readFileSync(letter, UTF8);
    const result = await rx.coverLetters.update({
      ...fields,
      markdown,
    });
    printLetter(UpdateLetterLabel.Updated, result, fields.template);
  },
});
