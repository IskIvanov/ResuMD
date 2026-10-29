/**
 * index.ts
 *
 * The Reactive Resume tools, in menu order: generate, update and delete a
 * resume from Resume.md, then the same for a cover letter from its `.md`.
 * Each connects, reads its file, runs an operation and prints what it wrote.
 * Every tool is disabled in the menu until `.env` has the Reactive Resume
 * settings. Deleting this folder and its line in src/cli/index.ts removes
 * the platform.
 */

import { defineTool } from "../cli/define-tool.ts";
import {
  FileExtension,
  OptionKind,
  type RunContext,
  type ToolDefinition,
} from "../cli/types.ts";
import { slugify } from "../utils/string.ts";
import type { RxResumeApiClient } from "./api/client.ts";
import { apiConfigProblem, connectRxResume } from "./api/config.ts";
import {
  type CoverLetter,
  CoverLetterTemplate,
  type Resume,
} from "./api/types.ts";
import {
  deleteCoverLetter,
  generateCoverLetter,
  updateCoverLetter,
} from "./operations/cover-letter/index.ts";
import {
  deleteResume,
  generateResume,
  updateResume,
} from "./operations/resume/index.ts";
import { CoverLetterIdSchema } from "./schema.ts";
import type { LetterFields } from "./types.ts";

// ─── Shared ───────────────────────────────────────────────────────────────────

/** A Markdown file that must already exist. */
const MARKDOWN_FILE = { extensions: [FileExtension.Markdown], mustExist: true };

const RESUME_FILE_OPTION = {
  message: "Path to Resume.md",
  kind: OptionKind.Path,
  required: true,
  path: MARKDOWN_FILE,
} as const;

const LETTER_FILE_OPTION = {
  message: "Path to the cover letter (.md)",
  kind: OptionKind.Path,
  required: true,
  path: MARKDOWN_FILE,
} as const;

const APPLICATION_ID_OPTION = {
  message: "Id of the job application it's for",
  kind: OptionKind.Text,
  required: false,
} as const;

const COMPANY_OPTION = {
  message: "Company it's addressed to",
  kind: OptionKind.Text,
  required: false,
} as const;

/** Connects to the API that the run's `.env` configures. */
function connect(context: RunContext): RxResumeApiClient {
  return connectRxResume(context.env, context.fetch, {
    write: context.logError,
    now: context.now,
  });
}

/** Prints a written resume and its builder link. */
function printResume(
  context: RunContext,
  heading: string,
  resume: Resume,
  client: RxResumeApiClient,
): void {
  context.log(
    `${heading} "${resume.name}" (slug ${resume.slug}, id ${resume.id})`,
  );
  context.log(`  builder: ${client.builderUrl(resume.id)}`);
}

/**
 * Prints a written cover letter and its dashboard link. The template is shown
 * only when one was chosen, since the letter then no longer follows the
 * resume's design.
 */
function printLetter(
  context: RunContext,
  heading: string,
  letter: CoverLetter,
  client: RxResumeApiClient,
  template: string | undefined,
): void {
  const details = [`id ${letter.id}`, `revision ${letter.revision}`];
  if (template) details.push(`template ${template}`);
  context.log(`${heading} "${letter.name}" (${details.join(", ")})`);
  context.log(`  letter: ${client.letterUrl(letter.id)}`);
}

/** A cover-letter tool's metadata flags, named as the API names them. */
function letterFields(values: {
  name?: string;
  "resume-id"?: string;
  "application-id"?: string;
  company?: string;
  template?: CoverLetterTemplate;
}): LetterFields {
  return {
    name: values.name,
    resumeId: values["resume-id"],
    applicationId: values["application-id"],
    recipientCompany: values.company,
    template: values.template,
  };
}

// ─── Resumes ──────────────────────────────────────────────────────────────────

/** Parses Resume.md and creates a new resume from it. */
export const generateResumeTool = defineTool({
  id: "generate-rx-resume",
  title: "Generate resume",
  description: "create a new resume in Reactive Resume via its API",
  options: {
    resume: RESUME_FILE_OPTION,
    name: {
      message: "Name of the new resume",
      kind: OptionKind.Text,
      required: true,
    },
    slug: {
      message: "URL slug (must be unused)",
      kind: OptionKind.Text,
      required: false,
      default: (answers) => slugify(answers.name ?? ""),
    },
    tags: {
      message: "Tags, comma-separated",
      kind: OptionKind.List,
      required: false,
    },
  },
  preflight: apiConfigProblem,
  run: async ({ resume, name, slug, tags }, context) => {
    if (!slug) {
      throw new Error(`Cannot derive --slug from "${name}"; pass --slug`);
    }
    // Settings are checked before the file is read.
    const client = connect(context);
    const markdown = context.readFile(resume);
    const created = await generateResume(
      client,
      markdown,
      { name, slug, tags },
      context.newId,
    );
    printResume(context, "✓ Created", created, client);
  },
});

/** Parses Resume.md and writes it into a resume, by the id generate prints. */
export const updateResumeTool = defineTool({
  id: "update-rx-resume",
  title: "Update resume",
  description: "rewrite an existing resume in Reactive Resume from Resume.md",
  options: {
    id: {
      message: "Id of the resume to update",
      kind: OptionKind.Text,
      required: true,
    },
    resume: RESUME_FILE_OPTION,
  },
  preflight: apiConfigProblem,
  run: async ({ id, resume }, context) => {
    // Settings are checked before the file is read.
    const client = connect(context);
    const markdown = context.readFile(resume);
    const updated = await updateResume(client, id, markdown, context.newId);
    printResume(context, "✓ Updated", updated, client);
  },
});

/**
 * Permanently deletes a resume, by the id generate prints. The API also
 * removes its screenshots and PDFs, and rejects a locked resume.
 */
export const deleteResumeTool = defineTool({
  id: "delete-rx-resume",
  title: "Delete resume",
  description: "permanently delete a resume in Reactive Resume via its API",
  options: {
    id: {
      message: "Id of the resume to delete",
      kind: OptionKind.Text,
      required: true,
    },
  },
  preflight: apiConfigProblem,
  // The API returns no data on deletion, so only the id is printed.
  run: async ({ id }, context) => {
    await deleteResume(connect(context), id);
    context.log(`✓ Deleted resume ${id}`);
  },
});

// ─── Cover letters ────────────────────────────────────────────────────────────

/**
 * Parses a cover-letter `.md` and creates a letter from it, linked to a
 * resume for its sender details and design.
 */
export const generateCoverLetterTool = defineTool({
  id: "generate-cover-letter",
  title: "Generate cover letter",
  description: "create a cover letter in Reactive Resume from a .md",
  options: {
    letter: LETTER_FILE_OPTION,
    name: {
      message: "Name of the new cover letter",
      kind: OptionKind.Text,
      required: true,
    },
    "resume-id": {
      message: "Id of the resume it goes with (gives the sender and design)",
      kind: OptionKind.Text,
      required: true,
    },
    "application-id": APPLICATION_ID_OPTION,
    company: COMPANY_OPTION,
    template: {
      message: "Template (leave out to follow the resume's design)",
      kind: OptionKind.Choice,
      required: false,
      choices: Object.values(CoverLetterTemplate),
    },
  },
  preflight: apiConfigProblem,
  run: async (values, context) => {
    // Settings are checked before the file is read.
    const client = connect(context);
    const markdown = context.readFile(values.letter);
    const letter = await generateCoverLetter(
      client,
      markdown,
      {
        ...letterFields(values),
        name: values.name,
        resumeId: values["resume-id"],
      },
      context.today(),
    );
    printLetter(
      context,
      "✓ Created cover letter",
      letter,
      client,
      values.template,
    );
  },
});

/**
 * Parses a cover-letter `.md` and rewrites a letter from it, by the id
 * generate prints. A flag left out keeps the stored value.
 */
export const updateCoverLetterTool = defineTool({
  id: "update-cover-letter",
  title: "Update cover letter",
  description: "rewrite an existing cover letter in Reactive Resume from a .md",
  options: {
    id: {
      message: "Id of the cover letter to update",
      kind: OptionKind.Text,
      schema: CoverLetterIdSchema,
      required: true,
    },
    letter: LETTER_FILE_OPTION,
    name: { message: "New name", kind: OptionKind.Text, required: false },
    company: COMPANY_OPTION,
    "resume-id": {
      message: "Id of the resume it goes with",
      kind: OptionKind.Text,
      required: false,
    },
    "application-id": APPLICATION_ID_OPTION,
    template: {
      message: "Template (stops following the resume's design)",
      kind: OptionKind.Choice,
      required: false,
      choices: Object.values(CoverLetterTemplate),
    },
  },
  preflight: apiConfigProblem,
  run: async (values, context) => {
    // Settings are checked before the file is read.
    const client = connect(context);
    const markdown = context.readFile(values.letter);
    const letter = await updateCoverLetter(
      client,
      values.id,
      markdown,
      letterFields(values),
      context.today(),
    );
    printLetter(
      context,
      "✓ Updated cover letter",
      letter,
      client,
      values.template,
    );
  },
});

/**
 * Permanently deletes a cover letter, by the id generate prints: moves it to
 * Trash, then purges it. The API rejects a locked letter.
 */
export const deleteCoverLetterTool = defineTool({
  id: "delete-cover-letter",
  title: "Delete cover letter",
  description:
    "permanently delete a cover letter in Reactive Resume via its API",
  options: {
    id: {
      message: "Id of the cover letter to delete",
      kind: OptionKind.Text,
      schema: CoverLetterIdSchema,
      required: true,
    },
  },
  preflight: apiConfigProblem,
  run: async ({ id }, context) => {
    await deleteCoverLetter(connect(context), id);
    context.log(`✓ Permanently deleted cover letter ${id}`);
  },
});

/** Every Reactive Resume tool, in menu order. */
export const RX_RESUME_TOOLS: readonly ToolDefinition[] = [
  generateResumeTool,
  updateResumeTool,
  deleteResumeTool,
  generateCoverLetterTool,
  updateCoverLetterTool,
  deleteCoverLetterTool,
];
