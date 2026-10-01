/**
 * mocks.ts
 *
 * Every fixture the CLI engine tests use: a scripted fake prompter, stub
 * options and tools, and environments. Typed constants and small factories
 * only.
 */

import { resolve } from "path";
import { defineTool, toOptionDescriptors } from "./define-tool.ts";
import { PromptCancelledError } from "./errors.ts";
import type { CliDeps } from "./run-cli.ts";
import {
  CliLabel,
  FileExtension,
  OptionKind,
  Platform,
  type Choice,
  type Env,
  type MenuItem,
  type OptionDescriptor,
  type OptionSpecs,
  type OptionValues,
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
    throw new PromptCancelledError();
  };
  return { select: cancel, input: cancel, checkbox: cancel, confirm: cancel };
}

// ─── Tools ────────────────────────────────────────────────────────────────────

export enum StubFlag {
  Resume = "resume",
  Name = "name",
  Slug = "slug",
  Tags = "tags",
}

export enum StubMessage {
  Resume = "Path to Resume.md",
  Name = "Resume name",
  Slug = "URL slug",
  Tags = "Tags",
}

/** One option of each kind; the slug defaults to the lowercased name. */
export const stubSpecs = {
  [StubFlag.Resume]: {
    message: StubMessage.Resume,
    kind: OptionKind.Path,
    required: true,
    path: { extensions: [FileExtension.Markdown], mustExist: true },
  },
  [StubFlag.Name]: {
    message: StubMessage.Name,
    kind: OptionKind.Text,
    required: true,
  },
  [StubFlag.Slug]: {
    message: StubMessage.Slug,
    kind: OptionKind.Text,
    required: false,
    default: (given) => (given[StubFlag.Name] ?? "").toLowerCase(),
  },
  [StubFlag.Tags]: {
    message: StubMessage.Tags,
    kind: OptionKind.List,
    required: false,
  },
} as const satisfies OptionSpecs;

export const stubOptions: readonly OptionDescriptor[] =
  toOptionDescriptors(stubSpecs);

/** The usage line defineTool builds for stubSpecs under the id "stub". */
export const STUB_USAGE =
  "Usage: bun run cli stub --resume <path> --name <name> [--slug <slug>] [--tags <a,b>]";

/** A stub tool plus the argv of every call to its run. */
export interface StubTool {
  tool: ToolDefinition;
  calls: string[][];
}

/**
 * Builds a stub tool that records its runs.
 *
 * @example
 * const { tool, calls } = createStubTool({ platform: Platform.ReactiveResume });
 */
export function createStubTool(
  overrides: Partial<ToolDefinition> = {},
): StubTool {
  const calls: string[][] = [];
  const tool: ToolDefinition = {
    id: "stub",
    title: "Stub tool",
    description: "does nothing",
    platform: Platform.Site,
    command: "bun run stub",
    usage: "Usage: stub --resume <path> --name <name> [--slug <slug>]",
    options: stubOptions,
    run: async (argv) => {
      calls.push(argv);
    },
    ...overrides,
  };
  return { tool, calls };
}

/** A defineTool-built stub plus what each of its runs received. */
export interface DefinedStub {
  tool: ToolDefinition;
  runs: { values: OptionValues<typeof stubSpecs>; context: RunContext }[];
}

/**
 * Builds a stub tool with defineTool that records its parsed runs.
 *
 * @example
 * const { tool, runs } = createDefinedStub();
 */
export function createDefinedStub(): DefinedStub {
  const runs: DefinedStub["runs"] = [];
  const tool = defineTool({
    id: "stub",
    title: "Stub tool",
    description: "does nothing",
    platform: Platform.Site,
    options: stubSpecs,
    run: async (values, context) => {
      runs.push({ values, context });
    },
  });
  return { tool, runs };
}

/** Answers that fill every required stub option and tick nothing optional. */
export const stubRequiredScript: PromptScript = {
  [StubMessage.Resume]: "resume/Resume.md",
  [StubMessage.Name]: "Jane Doe",
  [CliLabel.OptionalFlags]: [],
};

/** A Site tool and a Reactive Resume tool whose preflight always fails. */
export const siteTool: ToolDefinition = createStubTool({
  id: "site",
  title: "Site tool",
}).tool;

export const builderTool: ToolDefinition = createStubTool({
  id: "builder",
  title: "Builder tool",
  platform: Platform.ReactiveResume,
  preflight: () => "Missing API_KEY.",
}).tool;

/** Picks the stub tool, fills its required options and confirms the run. */
export const runStubScript: PromptScript = {
  [CliLabel.PickTool]: "Stub tool",
  ...stubRequiredScript,
  [CliLabel.RunIt]: true,
};

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
