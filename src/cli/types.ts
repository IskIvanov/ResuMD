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
 *   order. The menu and the argument parser walk these.
 * - tool arguments: the words typed after a tool's id, e.g.
 *   `--id resume-1`. The menu builds them from the prompts' answers.
 * - answers: the raw string for each flag, as given in the tool arguments or
 *   typed at a prompt, or built by the option's default (Answers).
 * - values: the answers converted for each kind, as run receives them
 *   (OptionValues): absolute paths, split lists, checked choices.
 * - dependencies: what a step needs from the outside world, never option
 *   data, injected so tests can replace it. ToolDependencies is the working
 *   directory, environment variables and I/O a tool runs with; PathLookup is
 *   the working directory and existence check that path prompts validate
 *   against.
 */

import type { z } from "zod";
import type { EnvironmentVariables, FetchFunction } from "../utils/types.ts";

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
  Pdf = ".pdf",
  Docx = ".docx",
  OpenDocument = ".odt",
  Json = ".json",
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

/** Where relative paths start, and how to tell whether a file exists. */
export interface PathLookup {
  workingDirectory: string;
  exists: (absolutePath: string) => boolean;
}

// ─── Options ──────────────────────────────────────────────────────────────────

/** Builds an option's default from the answers so far, keyed by flag. */
type OptionDefault = (answers: Answers) => string;

interface BaseOption {
  /** What the menu asks for this option, e.g. "Path to Resume.md". */
  question: string;
  required: boolean;
  /** The value when the flag is left out; also shown in the optional-flag checkbox. */
  default?: OptionDefault;
}

interface PathOption extends BaseOption {
  kind: OptionKind.Path;
  path: PathRule;
}

interface ValueOption extends BaseOption {
  kind: OptionKind.Text | OptionKind.List;
  /** Checked at the prompt and in the tool arguments. */
  schema?: z.ZodType<string>;
}

/** A value picked from a fixed list: a select in the menu, checked in the tool arguments. */
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
 * The value run receives for one option: a list option's is an array, a
 * choice's one of its choices, and every other kind's a string.
 */
type OptionValue<TOption extends OptionSpec> =
  TOption["kind"] extends OptionKind.List
    ? string[]
    : TOption extends ChoiceOption
      ? TOption["choices"][number]
      : string;

/** Options that always have a value: required, defaulted, or a list ([] when absent). */
type AlwaysSet =
  | { required: true }
  | { default: OptionDefault }
  | { kind: OptionKind.List };

/** The typed values a tool's run receives, inferred from its OptionSpecs. */
export type OptionValues<TOptions extends OptionSpecs> = {
  [Flag in keyof TOptions]: TOptions[Flag] extends AlwaysSet
    ? OptionValue<TOptions[Flag]>
    : OptionValue<TOptions[Flag]> | undefined;
};

/** Any option's value, its kind erased: text, an absolute path, or a list. */
export type AnyOptionValue = string | string[] | undefined;

/** Each option's value for run, keyed by flag, with the kinds erased. */
type AnyOptionValues = Readonly<Record<string, AnyOptionValue>>;

// ─── Tools ────────────────────────────────────────────────────────────────────

/**
 * What a tool runs with, injected so tests can replace any of it: where
 * relative paths start, the environment variables that hold its settings,
 * and the network, clock, files and output it uses.
 */
export interface ToolDependencies {
  workingDirectory: string;
  environmentVariables: EnvironmentVariables;
  fetch: FetchFunction;
  /** A unique id per call; `crypto.randomUUID` in production. */
  newId: () => string;
  /** Today's date in the local time zone, as `YYYY-MM-DD`. */
  today: () => string;
  /** Milliseconds on a monotonic clock, to time API calls. */
  now: () => number;
  /** Reads a UTF-8 text file by its absolute path. */
  readFile: (absolutePath: string) => string;
  /** Writes bytes to a file by its absolute path, replacing what's there. */
  writeFile: (absolutePath: string, bytes: Uint8Array) => void;
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
  preflight?: (
    environmentVariables: EnvironmentVariables,
  ) => string | undefined;
  /** Does the work with the parsed values; throws on failure. */
  run: (
    values: OptionValues<TOptions>,
    dependencies: ToolDependencies,
  ) => Promise<void>;
}

/**
 * Everything the menu and the direct command need to list, prompt for and run
 * one tool. `TValues` is what `parse` returns: defineTool infers it from the
 * tool's specs, and the tool list erases it to AnyOptionValues.
 */
export interface ToolDefinition<
  TValues extends AnyOptionValues = AnyOptionValues,
> {
  id: string;
  title: string;
  description: string;
  /** The direct command, e.g. "bun run cli create-resume"; used in the printed command. */
  command: string;
  /** One line listing every flag. */
  usage: string;
  /** The tool's options, each with its flag, in prompt order. */
  options: readonly OptionDescriptor[];
  /** Returns why the tool can't run, or undefined when it can. */
  preflight?: (
    environmentVariables: EnvironmentVariables,
  ) => string | undefined;
  /**
   * Parses the tool arguments into the values run receives, without running
   * the tool. Throws for a missing option, an invalid choice or a value its
   * schema refuses.
   */
  parse(toolArguments: readonly string[], workingDirectory: string): TValues;
  /** Parses the tool arguments against the options, then runs the tool. */
  run(
    toolArguments: readonly string[],
    dependencies: ToolDependencies,
  ): Promise<void>;
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

/** Returns true when the answer is valid, or the problem to show. */
export type Validator = (answer: string) => true | string;

/**
 * The prompts the CLI uses, in CLI-owned shapes. Only src/cli/index.ts adapts
 * a real prompt library to it, so everything else is testable with a fake.
 */
export interface Prompter {
  select<TValue>(prompt: {
    question: string;
    choices: readonly Choice<TValue>[];
  }): Promise<TValue>;
  input(prompt: { question: string; validate?: Validator }): Promise<string>;
  checkbox<TValue>(prompt: {
    question: string;
    choices: readonly Choice<TValue>[];
  }): Promise<TValue[]>;
  confirm(prompt: { question: string; default: boolean }): Promise<boolean>;
}

// ─── runCli ───────────────────────────────────────────────────────────────────

/**
 * Everything runCli reads from or writes to the outside world. A tool runs
 * with the same I/O, so runCli passes these on as its ToolDependencies.
 */
export interface CliDependencies extends ToolDependencies {
  /** The words after the script name: a tool id and its arguments, or none to open the menu. */
  commandLineArguments: readonly string[];
  tools: readonly ToolDefinition[];
  prompter: Prompter;
  /** True when stdin and stdout are a terminal, so the menu can prompt. */
  isInteractiveTerminal: boolean;
  /** Checks a path typed at a prompt. */
  exists: (absolutePath: string) => boolean;
}
