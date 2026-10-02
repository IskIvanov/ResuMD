/**
 * types.ts
 *
 * Every type and fixed value set the CLI declares. A tool file declares a
 * ToolSpec; defineTool turns it into the ToolDefinition that the menu and the
 * direct command read. Neither ever sees a tool's internals.
 */

/** Menu groups. Names what a tool does or where it writes, never a vendor. */
export enum Platform {
  Site = "Site",
  ReactiveResume = "Reactive Resume",
  JobApplication = "Job Application",
}

/** How an option is prompted for, validated and parsed. */
export enum OptionKind {
  Path = "path",
  Text = "text",
  List = "list",
}

/** File extensions a path option can accept. */
export enum FileExtension {
  Markdown = ".md",
  Json = ".json",
  Pdf = ".pdf",
  Docx = ".docx",
  Text = ".txt",
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

/** Every UI string the CLI prints; the single extraction point for i18n. */
export enum CliLabel {
  PickTool = "Which tool do you want to run?",
  Exit = "Exit",
  OptionalFlags = "Set any optional flags?",
  Default = "default",
  RunIt = "Run it?",
  Cancelled = "Cancelled.",
  Unavailable = "Not available",
  NeedsTerminal = "resume-tools cli needs an interactive terminal. Run a tool directly:",
  UnknownTool = "Unknown tool",
  RunOneOf = "Run one of:",
  Usage = "Usage:",
  IsRequired = "is required",
  PathPlaceholder = "<path>",
  ListPlaceholder = "<a,b>",
  ValueRequired = "A value is required",
  PathRequired = "A path is required",
  MissingExtension = "Missing file extension",
  UnsupportedFormat = "Unsupported format",
  Expected = "expected",
  FileNotFound = "File not found",
}

/** Environment variables, usually `process.env` after Bun has loaded `.env`. */
export type Env = Record<string, string | undefined>;

/** Answers collected so far, keyed by option flag. */
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

/** Builds an option's default from the values given so far, keyed by flag. */
export type DefaultFn = (given: Answers) => string;

interface BaseOption {
  /** Prompt text. */
  message: string;
  required: boolean;
  /** The value when the flag is left out; also shown in the optional-flag checkbox. */
  default?: DefaultFn;
}

export interface PathOption extends BaseOption {
  kind: OptionKind.Path;
  path: PathRule;
}

export interface ValueOption extends BaseOption {
  kind: OptionKind.Text | OptionKind.List;
}

/** One option as a tool declares it; its flag is its key in OptionSpecs. */
export type OptionSpec = PathOption | ValueOption;

/** A tool's options, keyed by flag name without dashes, in prompt order. */
export type OptionSpecs = Readonly<Record<string, OptionSpec>>;

/** An option together with its flag, as the menu prompts for it. */
export type OptionDescriptor = OptionSpec & { flag: string };

/** A list option parses to an array; every other kind to a string. */
type ParsedValue<TOption extends OptionSpec> =
  TOption["kind"] extends OptionKind.List ? string[] : string;

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

// ─── Tools ────────────────────────────────────────────────────────────────────

/** Where a tool runs: the base directory for relative paths, and the environment. */
export interface RunContext {
  cwd: string;
  env: Env;
}

/** What a tool file declares; defineTool turns it into a ToolDefinition. */
export interface ToolSpec<TOptions extends OptionSpecs> {
  /** Also the first argument of the direct command: `bun run cli <id>`. */
  id: string;
  title: string;
  description: string;
  platform: Platform;
  options: TOptions;
  /** Returns why the tool can't run, or undefined when it can. */
  preflight?: (env: Env) => string | undefined;
  /** Does the work with the parsed values; throws on failure. */
  run: (values: OptionValues<TOptions>, context: RunContext) => Promise<void>;
}

/** Everything the menu and the direct command need to list, prompt for and run one tool. */
export interface ToolDefinition {
  id: string;
  title: string;
  description: string;
  platform: Platform;
  /** The direct command, e.g. "bun run cli sync-resume"; used in the printed command. */
  command: string;
  /** One line listing every flag. */
  usage: string;
  options: readonly OptionDescriptor[];
  /** Returns why the tool can't run, or undefined when it can. */
  preflight?: (env: Env) => string | undefined;
  /** Parses argv against the options, then runs the tool. */
  run: (argv: string[], context: RunContext) => Promise<void>;
}

// ─── Prompter ─────────────────────────────────────────────────────────────────

export interface Choice<TValue> {
  name: string;
  value: TValue;
  /** A reason string shows the choice greyed out and unselectable. */
  disabled?: string;
}

export interface SeparatorItem {
  separator: string;
}

export type MenuItem<TValue> = Choice<TValue> | SeparatorItem;

/** Returns true when the value is valid, or the message to show. */
export type Validator = (value: string) => true | string;

/**
 * The prompts the CLI uses, in CLI-owned shapes. Only src/cli/index.ts adapts
 * a real prompt library to it, so everything else is testable with a fake.
 */
export interface Prompter {
  select<TValue>(config: {
    message: string;
    choices: readonly MenuItem<TValue>[];
  }): Promise<TValue>;
  input(config: { message: string; validate?: Validator }): Promise<string>;
  checkbox<TValue>(config: {
    message: string;
    choices: readonly Choice<TValue>[];
  }): Promise<TValue[]>;
  confirm(config: { message: string; default: boolean }): Promise<boolean>;
}
