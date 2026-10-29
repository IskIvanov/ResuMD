/**
 * types.ts
 *
 * Every type and fixed value set the CLI declares. A tool file declares a
 * ToolSpec; defineTool turns it into the ToolDefinition that the menu and the
 * direct command read. Neither ever sees a tool's internals.
 *
 * Terms, from what a tool declares to what its run receives:
 * - spec: one option as a tool file declares it (OptionSpec). A tool's specs
 *   are keyed by flag (OptionSpecs).
 * - option: a spec together with its flag (OptionDescriptor), in declaration
 *   order. The menu and the argv parser walk these.
 * - answers: the raw string for each flag, as given on argv or typed at a
 *   prompt, or built by the option's default (Answers).
 * - values: the answers converted for each kind, as run receives them
 *   (OptionValues): absolute paths, split lists, checked choices.
 * - context: what a step needs from outside, never option data. RunContext
 *   is the cwd, env and outside world a tool runs with; PathContext is the
 *   cwd and existence check that path prompts validate against.
 */

import type { z } from "zod";
import type { Env, FetchFn } from "../utils/types.ts";

/** How an option is prompted for, validated and parsed. */
export enum OptionKind {
  Path = "path",
  Text = "text",
  List = "list",
  Choice = "choice",
}

/** File extensions a path option can accept. */
export enum FileExtension {
  Markdown = ".md",
}

export enum ExitCode {
  Success = 0,
  Failure = 1,
  Cancelled = 130,
}

/** Non-tool menu entries. */
export enum MenuAction {
  Exit = "exit",
}

/** Answers so far, keyed by option flag: given, typed or defaulted strings. */
export type Answers = Readonly<Record<string, string>>;

/** Which files a path option accepts. */
export interface PathRule {
  extensions: readonly FileExtension[];
  mustExist: boolean;
}

/** What the path check needs from the outside world. */
export interface PathContext {
  /** Base directory for relative paths. */
  cwd: string;
  exists: (absolutePath: string) => boolean;
}

// ─── Options ──────────────────────────────────────────────────────────────────

/** Builds an option's default from the answers so far, keyed by flag. */
type DefaultFn = (answers: Answers) => string;

interface BaseOption {
  /** Prompt text. */
  message: string;
  required: boolean;
  /** The value when the flag is left out; also shown in the optional-flag checkbox. */
  default?: DefaultFn;
}

interface PathOption extends BaseOption {
  kind: OptionKind.Path;
  path: PathRule;
}

interface ValueOption extends BaseOption {
  kind: OptionKind.Text | OptionKind.List;
  /** Checked at the prompt and in argv. */
  schema?: z.ZodType<string>;
}

/** A value picked from a fixed list: a select in the menu, checked in argv. */
interface ChoiceOption extends BaseOption {
  kind: OptionKind.Choice;
  choices: readonly string[];
}

/** One option as a tool declares it; its flag is its key in OptionSpecs. */
type OptionSpec = PathOption | ValueOption | ChoiceOption;

/** A tool's options, keyed by flag name without dashes, in prompt order. */
export type OptionSpecs = Readonly<Record<string, OptionSpec>>;

/** An option together with its flag, as the menu prompts for it. */
export type OptionDescriptor = OptionSpec & { flag: string };

/**
 * A list option parses to an array, a choice to one of its choices, and every
 * other kind to a string.
 */
type ParsedValue<TOption extends OptionSpec> =
  TOption["kind"] extends OptionKind.List
    ? string[]
    : TOption extends ChoiceOption
      ? TOption["choices"][number]
      : string;

/** Options that always have a value: required, defaulted, or a list ([] when absent). */
type AlwaysSet =
  | { required: true }
  | { default: DefaultFn }
  | { kind: OptionKind.List };

/** The typed values a tool's run receives, inferred from its OptionSpecs. */
export type OptionValues<TOptions extends OptionSpecs> = {
  [K in keyof TOptions]: TOptions[K] extends AlwaysSet
    ? ParsedValue<TOptions[K]>
    : ParsedValue<TOptions[K]> | undefined;
};

/** What run receives for one option: text, an absolute path, or a list. */
export type ResolvedValue = string | string[] | undefined;

/** Each option's value for run, keyed by flag, with the kinds erased. */
type ResolvedValues = Readonly<Record<string, ResolvedValue>>;

// ─── Tools ────────────────────────────────────────────────────────────────────

/**
 * What a tool runs with: the base directory for relative paths, the
 * environment, and the outside world it reads from and writes to.
 */
export interface RunContext {
  cwd: string;
  env: Env;
  fetch: FetchFn;
  /** A unique id per call; `crypto.randomUUID` in production. */
  newId: () => string;
  /** Today's date in the local time zone, as `YYYY-MM-DD`. */
  today: () => string;
  /** Milliseconds on a monotonic clock, to time requests. */
  now: () => number;
  /** Reads a UTF-8 text file by its absolute path. */
  readFile: (absolutePath: string) => string;
  log: (line: string) => void;
  logError: (line: string) => void;
}

/** What a tool file declares; defineTool turns it into a ToolDefinition. */
export interface ToolSpec<TOptions extends OptionSpecs> {
  /** Also the first argument of the direct command: `bun run cli <id>`. */
  id: string;
  title: string;
  description: string;
  options: TOptions;
  /** Returns why the tool can't run, or undefined when it can. */
  preflight?: (env: Env) => string | undefined;
  /** Does the work with the parsed values; throws on failure. */
  run: (values: OptionValues<TOptions>, context: RunContext) => Promise<void>;
}

/**
 * Everything the menu and the direct command need to list, prompt for and run
 * one tool. `TValues` is what `parse` returns: defineTool infers it from the
 * tool's specs, and the registry erases it to ResolvedValues.
 */
export interface ToolDefinition<
  TValues extends ResolvedValues = ResolvedValues,
> {
  id: string;
  title: string;
  description: string;
  /** The direct command, e.g. "bun run cli generate-rx-resume"; used in the printed command. */
  command: string;
  /** One line listing every flag. */
  usage: string;
  /** The tool's options, each with its flag, in prompt order. */
  options: readonly OptionDescriptor[];
  /** Returns why the tool can't run, or undefined when it can. */
  preflight?: (env: Env) => string | undefined;
  /**
   * Parses argv into the values run receives, without running the tool.
   * Throws for a missing option, an invalid choice or a value its schema
   * refuses.
   */
  parse(argv: readonly string[], cwd: string): TValues;
  /** Parses argv against the options, then runs the tool. */
  run(argv: readonly string[], context: RunContext): Promise<void>;
}

// ─── Prompter ─────────────────────────────────────────────────────────────────

export interface Choice<TValue> {
  name: string;
  value: TValue;
  /** A reason string shows the choice greyed out and unselectable. */
  disabled?: string;
}

/** A menu entry's value: the tool to run, or a non-tool action. */
export type MenuValue = ToolDefinition | MenuAction;

/** Returns true when the value is valid, or the message to show. */
export type Validator = (value: string) => true | string;

/**
 * The prompts the CLI uses, in CLI-owned shapes. Only src/cli/index.ts adapts
 * a real prompt library to it, so everything else is testable with a fake.
 */
export interface Prompter {
  select<TValue>(config: {
    message: string;
    choices: readonly Choice<TValue>[];
  }): Promise<TValue>;
  input(config: { message: string; validate?: Validator }): Promise<string>;
  checkbox<TValue>(config: {
    message: string;
    choices: readonly Choice<TValue>[];
  }): Promise<TValue[]>;
  confirm(config: { message: string; default: boolean }): Promise<boolean>;
}

// ─── runCli ───────────────────────────────────────────────────────────────────

/**
 * Everything runCli reads from or writes to the outside world. A tool runs
 * with the same context, so runCli passes these deps on as its RunContext.
 */
export interface CliDeps extends RunContext {
  /** Arguments after the script name; empty opens the menu. */
  argv: readonly string[];
  tools: readonly ToolDefinition[];
  prompter: Prompter;
  isTTY: boolean;
  /** Checks a path typed at a prompt. */
  exists: (absolutePath: string) => boolean;
}
