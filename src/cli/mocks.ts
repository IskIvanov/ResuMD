/**
 * mocks.ts
 *
 * Every fixture the CLI tests use: a scripted fake prompter, environments,
 * prompt scripts for the registered tools and what each tool should show.
 * Tests run the real tools from the registry; the one double,
 * withRecordedRuns, keeps a tool's declaration and only replaces its work.
 * Typed constants and small factories only.
 */

import { resolve } from "path";
import { EnvVar as CareersEnvVar } from "../careers-api/config.ts";
import { EnvVar as RxResumeEnvVar } from "../rx-resume/config.ts";
import { CliError } from "./errors.ts";
import type { CliDeps } from "./run-cli.ts";
import { encodeTool } from "./tools/encode-cv.ts";
import { generateCoverLetterTool } from "./tools/generate-cover-letter.ts";
import { generateTool } from "./tools/generate-rx-resume.ts";
import { updateCoverLetterTool } from "./tools/update-cover-letter.ts";
import {
  CliErrorCode,
  CliLabel,
  FileExtension,
  MenuAction,
  Platform,
  type Choice,
  type Env,
  type MenuItem,
  type PathContext,
  type PathRule,
  type Prompter,
  type RunContext,
  type ToolDefinition,
} from "./types.ts";

// ─── Paths ────────────────────────────────────────────────────────────────────

export const CWD = "/work/resume-tools";

/** Files that exist in the fake file system, relative to CWD. */
export const EXISTING_FILES = ["resume/Resume.md", "cv.md"] as const;

export const pathContext: PathContext = {
  cwd: CWD,
  exists: (absolutePath) =>
    EXISTING_FILES.some((file) => resolve(CWD, file) === absolutePath),
};

export const markdownRule: PathRule = {
  extensions: [FileExtension.Markdown],
  mustExist: true,
};

// ─── Environments ─────────────────────────────────────────────────────────────

export const emptyEnv: Env = {};

/** The Reactive Resume settings from `.env`. */
export const rxResumeEnv: Env = {
  [RxResumeEnvVar.ApiKey]: "key",
  [RxResumeEnvVar.BaseUrl]: "https://rx.example/api/openapi",
  [RxResumeEnvVar.AppUrl]: "https://rx.example",
};

/** The Careers API settings from `.env`. */
export const careersEnv: Env = {
  [CareersEnvVar.ApiUrl]: "https://careers.example/api",
};

/** Every setting any tool needs, so every preflight passes. */
export const fullEnv: Env = { ...rxResumeEnv, ...careersEnv };

/** Runs a tool from CWD with no settings, so an API tool fails before a request. */
export const runContext: RunContext = { cwd: CWD, env: emptyEnv };

// ─── Prompter ─────────────────────────────────────────────────────────────────

/** A scripted answer: select/input take text, checkbox a list, confirm a boolean. */
export type ScriptedAnswer = string | readonly string[] | boolean;

/** Answers keyed by prompt message. */
export type PromptScript = Readonly<Record<string, ScriptedAnswer>>;

function isChoice<TValue>(item: MenuItem<TValue>): item is Choice<TValue> {
  return "value" in item;
}

/**
 * A Prompter that answers from a script keyed by prompt message.
 *
 * - select picks the first enabled choice whose name starts with the answer
 * - input runs the prompt's validator and throws if the answer is rejected
 * - checkbox picks the choices whose value is in the answer list
 * - any prompt missing from the script throws
 */
export function createFakePrompter(script: PromptScript): Prompter {
  const answer = (message: string): ScriptedAnswer => {
    if (!(message in script)) throw new Error(`Unscripted prompt: ${message}`);
    return script[message];
  };

  return {
    async select({ message, choices }) {
      const text = String(answer(message));
      const choice = choices
        .filter(isChoice)
        .find((item) => item.name.startsWith(text) && !item.disabled);
      if (!choice) throw new Error(`No enabled choice "${text}" in ${message}`);
      return choice.value;
    },
    async input({ message, validate }) {
      const text = String(answer(message));
      const verdict = validate ? validate(text) : true;
      if (verdict !== true) throw new Error(`Rejected "${text}": ${verdict}`);
      return text;
    },
    async checkbox({ message, choices }) {
      const picked = answer(message);
      const values = Array.isArray(picked) ? picked : [];
      return choices
        .filter((choice) => values.includes(String(choice.value)))
        .map((choice) => choice.value);
    },
    async confirm({ message }) {
      return answer(message) === true;
    },
  };
}

/** A Prompter whose every prompt is cancelled, as if Ctrl+C was pressed. */
export function createCancellingPrompter(): Prompter {
  const cancel = async (): Promise<never> => {
    throw new CliError({ code: CliErrorCode.PromptCancelled });
  };
  return { select: cancel, input: cancel, checkbox: cancel, confirm: cancel };
}

// ─── Tools ────────────────────────────────────────────────────────────────────

/**
 * The prompt message of one of a tool's options, so a script answers the
 * tool's real prompts.
 *
 * @example
 * promptFor(encodeTool, "cv"); // "Path to the CV (.pdf, .docx or .md)"
 */
export function promptFor(tool: ToolDefinition, flag: string): string {
  const option = tool.options.find((candidate) => candidate.flag === flag);
  if (!option) throw new Error(`${tool.id} has no --${flag}`);
  return option.message;
}

/** A registered tool whose run records its argv instead of doing the work. */
export interface RecordedTool {
  tool: ToolDefinition;
  calls: string[][];
}

/**
 * Keeps a tool's id, options and usage, and replaces only its run, so a test
 * can drive the real tool through the CLI without touching files or APIs.
 *
 * @example
 * const { tool, calls } = withRecordedRuns(encodeTool);
 */
export function withRecordedRuns(tool: ToolDefinition): RecordedTool {
  const calls: string[][] = [];
  return {
    tool: {
      ...tool,
      run: async (argv) => {
        calls.push([...argv]);
      },
    },
    calls,
  };
}

/**
 * Keeps a tool's id, options and usage, and replaces only its run with one
 * that throws `error`, so a test can see how the CLI reports a failure.
 *
 * @example
 * const tool = withFailingRun(encodeTool, new Error("boom"));
 */
export function withFailingRun(
  tool: ToolDefinition,
  error: unknown,
): ToolDefinition {
  return {
    ...tool,
    run: async () => {
      throw error;
    },
  };
}

/** generate-cover-letter's required flags; the letter needn't exist to parse. */
export const GENERATE_LETTER_ARGV: readonly string[] = [
  "--letter",
  "letter.md",
  "--name",
  "Acme — Frontend",
  "--resume-id",
  "resume-1",
];

/** Fills generate-rx-resume's required options and ticks nothing optional. */
export const generateRequiredScript: PromptScript = {
  [promptFor(generateTool, "resume")]: "resume/Resume.md",
  [promptFor(generateTool, "name")]: "Jane Doe",
  [CliLabel.OptionalFlags]: [],
};

/** Fills generate-cover-letter's required options and ticks --template. */
export const generateLetterTemplateScript: PromptScript = {
  [promptFor(generateCoverLetterTool, "letter")]: "cv.md",
  [promptFor(generateCoverLetterTool, "name")]: "Acme — Frontend",
  [promptFor(generateCoverLetterTool, "resume-id")]: "resume-1",
  [CliLabel.OptionalFlags]: ["template"],
  [promptFor(generateCoverLetterTool, "template")]: "onyx",
};

/** Fills update-cover-letter's required options and ticks nothing optional. */
export const updateLetterRequiredScript: PromptScript = {
  [promptFor(updateCoverLetterTool, "id")]:
    "3f2b8c1e-5d4a-4e7b-9a6c-1d2e3f4a5b6c",
  [promptFor(updateCoverLetterTool, "letter")]: "cv.md",
  [CliLabel.OptionalFlags]: [],
};

/** Fills encode-cv's one required option and ticks nothing optional. */
export const encodeRequiredScript: PromptScript = {
  [promptFor(encodeTool, "cv")]: "cv.md",
  [CliLabel.OptionalFlags]: [],
};

/** Picks encode-cv from the menu, fills its required option and runs it. */
export const runEncodeScript: PromptScript = {
  [CliLabel.PickTool]: encodeTool.title,
  ...encodeRequiredScript,
  [CliLabel.RunIt]: true,
};

/** The cover-letter tools, in menu order. */
export const COVER_LETTER_TOOL_IDS = [
  "generate-cover-letter",
  "update-cover-letter",
  "delete-cover-letter",
] as const;

/** Tools with no settings to check, so they're never disabled. */
export const ALWAYS_AVAILABLE_TOOL_IDS: readonly string[] = [
  "encode-cv",
  "decode-cv",
];

/** Every tool's usage line, as `bun run cli` prints it, keyed by tool id. */
export const USAGE_BY_TOOL_ID: Readonly<Record<string, string>> = {
  "generate-rx-resume":
    "Usage: bun run cli generate-rx-resume --resume <path> --name <name> [--slug <slug>] [--tags <a,b>]",
  "update-rx-resume":
    "Usage: bun run cli update-rx-resume --id <id> --resume <path>",
  "delete-rx-resume": "Usage: bun run cli delete-rx-resume --id <id>",
  "generate-cover-letter":
    "Usage: bun run cli generate-cover-letter --letter <path> --name <name> --resume-id <resume-id> [--application-id <application-id>] [--company <company>] [--template <template>]",
  "update-cover-letter":
    "Usage: bun run cli update-cover-letter --id <id> --letter <path> [--name <name>] [--company <company>] [--resume-id <resume-id>] [--application-id <application-id>] [--template <template>]",
  "delete-cover-letter": "Usage: bun run cli delete-cover-letter --id <id>",
  "encode-cv": "Usage: bun run cli encode-cv --cv <path> [--out <path>]",
  "decode-cv": "Usage: bun run cli decode-cv --base64 <path> --out <path>",
  "apply-job":
    "Usage: bun run cli apply-job --vacancy <vacancy> --first-name <first-name> --last-name <last-name> --email <email> --telephone <telephone> --motivation <motivation> --linkedin-url <linkedin-url> --github-url <github-url> --cv <path> --mode <mode>",
};

/**
 * The menu built from every tool, one entry per line: a platform heading, a
 * tool id, or Exit.
 */
export const MENU_LAYOUT: readonly string[] = [
  `── ${Platform.ReactiveResume} ──`,
  "generate-rx-resume",
  "update-rx-resume",
  "delete-rx-resume",
  ...COVER_LETTER_TOOL_IDS,
  `── ${Platform.JobApplication} ──`,
  "encode-cv",
  "decode-cv",
  "apply-job",
  MenuAction.Exit,
];

// ─── runCli harness ───────────────────────────────────────────────────────────

/** runCli dependencies plus everything they printed. */
export interface CliHarness {
  deps: CliDeps;
  output: string[];
  errors: string[];
}

/**
 * Builds runCli dependencies that answer from a script and capture output.
 *
 * @example
 * const { deps, errors } = createCliHarness([tool], {}, { isTTY: false });
 */
export function createCliHarness(
  tools: readonly ToolDefinition[],
  script: PromptScript,
  overrides: Partial<CliDeps> = {},
): CliHarness {
  const output: string[] = [];
  const errors: string[] = [];
  const deps: CliDeps = {
    argv: [],
    tools,
    prompter: createFakePrompter(script),
    env: emptyEnv,
    isTTY: true,
    pathContext,
    log: (line) => output.push(line),
    logError: (line) => errors.push(line),
    ...overrides,
  };
  return { deps, output, errors };
}
