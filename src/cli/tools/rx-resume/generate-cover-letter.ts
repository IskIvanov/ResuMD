/**
 * generate-cover-letter.ts
 *
 * Parses a cover-letter `.md` and creates a cover letter in Reactive Resume
 * via its API, linked to a resume for its sender details and design.
 * Disabled in the menu until `.env` has the Reactive Resume settings.
 */

import { readFileSync } from "fs";
import {
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
  Created = "✓ Created cover letter",
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
  preflight: rxResumeProblem,
  run: async (values, { env }) => {
    // Each kebab-case flag is the camelCase input field of the same name.
    const { letter, ...fields } = camelCaseKeys(values);
    // Settings are checked before the file is read.
    const rx = connect(env);
    const markdown = readFileSync(letter, UTF8);
    const result = await rx.coverLetters.generate({
      ...fields,
      markdown,
    });
    printLetter(GenerateLetterLabel.Created, result, fields.template);
  },
});
