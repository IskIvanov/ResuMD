/**
 * index.ts
 *
 * The Reactive Resume tools, in menu order: create, update and delete a
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
  type ToolDefinition,
  type ToolDependencies,
} from "../cli/types.ts";
import { slugify } from "../utils/string.ts";
import type { RxResumeApiClient } from "./api/client.ts";
import { connectRxResume, describeMissingSettings } from "./api/settings.ts";
import {
  type CoverLetter,
  CoverLetterTemplate,
  type Resume,
} from "./api/types.ts";
import {
  createCoverLetter,
  deleteCoverLetter,
  updateCoverLetter,
} from "./operations/cover-letter/index.ts";
import {
  createResume,
  deleteResume,
  updateResume,
} from "./operations/resume/index.ts";
import { CoverLetterIdSchema } from "./schema.ts";
import type { LetterFields } from "./types.ts";

// ─── Shared ───────────────────────────────────────────────────────────────────

/** A Markdown file that must already exist. */
const MARKDOWN_FILE = { extensions: [FileExtension.Markdown], mustExist: true };

const RESUME_FILE_OPTION = {
  question: "Path to Resume.md",
  kind: OptionKind.Path,
  required: true,
  path: MARKDOWN_FILE,
} as const;

const LETTER_FILE_OPTION = {
  question: "Path to the cover letter (.md)",
  kind: OptionKind.Path,
  required: true,
  path: MARKDOWN_FILE,
} as const;

const APPLICATION_ID_OPTION = {
  question: "Id of the job application it's for",
  kind: OptionKind.Text,
  required: false,
} as const;

const COMPANY_OPTION = {
  question: "Company it's addressed to",
  kind: OptionKind.Text,
  required: false,
} as const;

/** Connects to the instance the run's `.env` settings name. */
function connect(dependencies: ToolDependencies): RxResumeApiClient {
  return connectRxResume(
    dependencies.environmentVariables,
    dependencies.fetch,
    { write: dependencies.logError, now: dependencies.now },
  );
}

/** Prints a written resume and the link that opens it in the editor. */
function printResume(
  dependencies: ToolDependencies,
  heading: string,
  resume: Resume,
  client: RxResumeApiClient,
): void {
  dependencies.log(
    `${heading} "${resume.name}" (slug ${resume.slug}, id ${resume.id})`,
  );
  dependencies.log(`  editor: ${client.resumeEditorUrl(resume.id)}`);
}

/**
 * Prints a written cover letter and the link that opens it. The template is
 * shown only when one was chosen, since the letter then no longer matches
 * its source resume.
 */
function printLetter(
  dependencies: ToolDependencies,
  heading: string,
  letter: CoverLetter,
  client: RxResumeApiClient,
  template: string | undefined,
): void {
  const details = [`id ${letter.id}`, `revision ${letter.revision}`];
  if (template) details.push(`template ${template}`);
  dependencies.log(`${heading} "${letter.name}" (${details.join(", ")})`);
  dependencies.log(`  editor: ${client.coverLetterEditorUrl(letter.id)}`);
}

/** A cover-letter tool's field flags, named as the API names them. */
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
export const createResumeTool = defineTool({
  id: "create-resume",
  title: "Create resume",
  description: "create a new resume in Reactive Resume from Resume.md",
  options: {
    resume: RESUME_FILE_OPTION,
    name: {
      question: "Name of the new resume",
      kind: OptionKind.Text,
      required: true,
    },
    slug: {
      question: "URL slug (must be unused)",
      kind: OptionKind.Text,
      required: false,
      default: (answers) => slugify(answers.name ?? ""),
    },
    tags: {
      question: "Tags, comma-separated",
      kind: OptionKind.List,
      required: false,
    },
  },
  preflight: describeMissingSettings,
  run: async ({ resume, name, slug, tags }, dependencies) => {
    if (!slug) {
      throw new Error(`Cannot derive --slug from "${name}"; pass --slug`);
    }
    // Settings are checked before the file is read.
    const client = connect(dependencies);
    const markdown = dependencies.readFile(resume);
    const created = await createResume(
      client,
      markdown,
      { name, slug, tags },
      dependencies.newId,
    );
    printResume(dependencies, "✓ Created", created, client);
  },
});

/** Parses Resume.md and writes it into a resume, by the id create prints. */
export const updateResumeTool = defineTool({
  id: "update-resume",
  title: "Update resume",
  description: "rewrite an existing resume in Reactive Resume from Resume.md",
  options: {
    id: {
      question: "Id of the resume to update",
      kind: OptionKind.Text,
      required: true,
    },
    resume: RESUME_FILE_OPTION,
  },
  preflight: describeMissingSettings,
  run: async ({ id, resume }, dependencies) => {
    // Settings are checked before the file is read.
    const client = connect(dependencies);
    const markdown = dependencies.readFile(resume);
    const updated = await updateResume(
      client,
      id,
      markdown,
      dependencies.newId,
    );
    printResume(dependencies, "✓ Updated", updated, client);
  },
});

/**
 * Deletes a resume for good, by the id create prints: moves it to Trash,
 * then purges it. The API also removes its screenshots and PDFs, and rejects
 * a locked resume.
 */
export const deleteResumeTool = defineTool({
  id: "delete-resume",
  title: "Delete resume",
  description:
    "delete a resume in Reactive Resume: move it to Trash, then purge it",
  options: {
    id: {
      question: "Id of the resume to delete",
      kind: OptionKind.Text,
      required: true,
    },
  },
  preflight: describeMissingSettings,
  // The API returns no data on deletion, so only the id is printed.
  run: async ({ id }, dependencies) => {
    await deleteResume(connect(dependencies), id);
    dependencies.log(`✓ Deleted resume ${id}`);
  },
});

// ─── Cover letters ────────────────────────────────────────────────────────────

/**
 * Parses a cover-letter `.md` and creates a letter from it, linked to a
 * source resume for its sender details and design.
 */
export const createCoverLetterTool = defineTool({
  id: "create-cover-letter",
  title: "Create cover letter",
  description: "create a cover letter in Reactive Resume from a .md",
  options: {
    letter: LETTER_FILE_OPTION,
    name: {
      question: "Name of the new cover letter",
      kind: OptionKind.Text,
      required: true,
    },
    "resume-id": {
      question: "Id of the source resume (gives the sender details and design)",
      kind: OptionKind.Text,
      required: true,
    },
    "application-id": APPLICATION_ID_OPTION,
    company: COMPANY_OPTION,
    template: {
      question: "Template (leave out to match the resume's design)",
      kind: OptionKind.Choice,
      required: false,
      choices: Object.values(CoverLetterTemplate),
    },
  },
  preflight: describeMissingSettings,
  run: async (values, dependencies) => {
    // Settings are checked before the file is read.
    const client = connect(dependencies);
    const markdown = dependencies.readFile(values.letter);
    const letter = await createCoverLetter(
      client,
      markdown,
      {
        ...letterFields(values),
        name: values.name,
        resumeId: values["resume-id"],
      },
      dependencies.today(),
    );
    printLetter(
      dependencies,
      "✓ Created cover letter",
      letter,
      client,
      values.template,
    );
  },
});

/**
 * Parses a cover-letter `.md` and rewrites a letter from it, by the id
 * create prints. A flag left out keeps the stored value.
 */
export const updateCoverLetterTool = defineTool({
  id: "update-cover-letter",
  title: "Update cover letter",
  description: "rewrite an existing cover letter in Reactive Resume from a .md",
  options: {
    id: {
      question: "Id of the cover letter to update",
      kind: OptionKind.Text,
      schema: CoverLetterIdSchema,
      required: true,
    },
    letter: LETTER_FILE_OPTION,
    name: { question: "New name", kind: OptionKind.Text, required: false },
    company: COMPANY_OPTION,
    "resume-id": {
      question: "Id of the source resume",
      kind: OptionKind.Text,
      required: false,
    },
    "application-id": APPLICATION_ID_OPTION,
    template: {
      question: "Template (stops matching the resume's design)",
      kind: OptionKind.Choice,
      required: false,
      choices: Object.values(CoverLetterTemplate),
    },
  },
  preflight: describeMissingSettings,
  run: async (values, dependencies) => {
    // Settings are checked before the file is read.
    const client = connect(dependencies);
    const markdown = dependencies.readFile(values.letter);
    const letter = await updateCoverLetter(
      client,
      values.id,
      markdown,
      letterFields(values),
      dependencies.today(),
    );
    printLetter(
      dependencies,
      "✓ Updated cover letter",
      letter,
      client,
      values.template,
    );
  },
});

/**
 * Deletes a cover letter for good, by the id create prints: moves it to
 * Trash, then purges it. The API rejects a locked letter.
 */
export const deleteCoverLetterTool = defineTool({
  id: "delete-cover-letter",
  title: "Delete cover letter",
  description:
    "delete a cover letter in Reactive Resume: move it to Trash, then purge it",
  options: {
    id: {
      question: "Id of the cover letter to delete",
      kind: OptionKind.Text,
      schema: CoverLetterIdSchema,
      required: true,
    },
  },
  preflight: describeMissingSettings,
  run: async ({ id }, dependencies) => {
    await deleteCoverLetter(connect(dependencies), id);
    dependencies.log(`✓ Deleted cover letter ${id}`);
  },
});

/** Every Reactive Resume tool, in menu order. */
export const RX_RESUME_TOOLS: readonly ToolDefinition[] = [
  createResumeTool,
  updateResumeTool,
  deleteResumeTool,
  createCoverLetterTool,
  updateCoverLetterTool,
  deleteCoverLetterTool,
];
