/**
 * apply-job.ts
 *
 * Validates a job application and sends it to the Careers API,
 * either as a test call that saves nothing or for real. Disabled in the menu
 * until `.env` has CAREERS_API_URL.
 */

import { runApply } from "../../apply-job/run.ts";
import { careersConfigProblem } from "../../careers-api/config.ts";
import { defineTool } from "../define-tool.ts";
import {
  FileExtension,
  OptionKind,
  Platform,
  type PathOption,
} from "../types.ts";

enum Option {
  Vacancy = "vacancy",
  FirstName = "first-name",
  LastName = "last-name",
  Email = "email",
  Telephone = "telephone",
  Motivation = "motivation",
  LinkedIn = "linkedin-url",
  GitHub = "github-url",
  Cv = "cv",
  Mode = "mode",
}

enum ApplyLabel {
  Id = "apply-job",
  Title = "Apply",
  Description = "validate an application and send it to the Careers API",
  Vacancy = "Vacancy slug, the last part of its URL (e.g. full-stack-developer-8)",
  FirstName = "First name",
  LastName = "Last name",
  Email = "Email",
  Telephone = "Dutch phone number",
  Motivation = "Motivation for this vacancy (up to 5000 characters)",
  LinkedIn = "LinkedIn profile URL",
  GitHub = "GitHub profile URL",
  Cv = "Path to the CV (.pdf)",
  Mode = "Mode: test (validated, nothing saved) or live (applies to the vacancy)",
}

/** Every option except --cv is a required line of text. */
const REQUIRED_TEXT = { kind: OptionKind.Text, required: true } as const;

const CV_OPTION = {
  message: ApplyLabel.Cv,
  kind: OptionKind.Path,
  required: true,
  path: {
    extensions: [FileExtension.Pdf],
    mustExist: true,
  },
} as const satisfies PathOption;

export const applyTool = defineTool({
  id: ApplyLabel.Id,
  title: ApplyLabel.Title,
  description: ApplyLabel.Description,
  platform: Platform.JobApplication,
  options: {
    [Option.Vacancy]: { message: ApplyLabel.Vacancy, ...REQUIRED_TEXT },
    [Option.FirstName]: { message: ApplyLabel.FirstName, ...REQUIRED_TEXT },
    [Option.LastName]: { message: ApplyLabel.LastName, ...REQUIRED_TEXT },
    [Option.Email]: { message: ApplyLabel.Email, ...REQUIRED_TEXT },
    [Option.Telephone]: { message: ApplyLabel.Telephone, ...REQUIRED_TEXT },
    [Option.Motivation]: { message: ApplyLabel.Motivation, ...REQUIRED_TEXT },
    [Option.LinkedIn]: { message: ApplyLabel.LinkedIn, ...REQUIRED_TEXT },
    [Option.GitHub]: { message: ApplyLabel.GitHub, ...REQUIRED_TEXT },
    [Option.Cv]: CV_OPTION,
    [Option.Mode]: { message: ApplyLabel.Mode, ...REQUIRED_TEXT },
  },
  preflight: careersConfigProblem,
  run: (values, { env }) =>
    runApply(
      {
        vacancy: values[Option.Vacancy],
        firstName: values[Option.FirstName],
        lastName: values[Option.LastName],
        email: values[Option.Email],
        telephone: values[Option.Telephone],
        motivation: values[Option.Motivation],
        linkedinUrl: values[Option.LinkedIn],
        githubUrl: values[Option.GitHub],
        cv: values[Option.Cv],
        mode: values[Option.Mode],
      },
      env,
    ),
});
