# Spec: Interactive CLI

Linear:
[BAC-49](https://linear.app/bck123/issue/BAC-49/integrate-cli-user-friendly-utility)
· Follow-up:
[BAC-53](https://linear.app/bck123/issue/BAC-53/move-test-fixtures-into-one-mocksts-per-tool-folder)

> **Revision (merged platforms):** a platform's tools now live in its own
> folder: `src/rx-resume/index.ts` declares them, `api/` holds the client and
> `operations/` the API calls. `RunContext` carries `fetch`, ids, the clock,
> file reads and output, so tests drive each tool through its argv.
> `src/cli/` is five files (`menu.ts`, `command.ts`, `schema.ts`,
> `registry.ts`, `errors.ts` and `tools/` are gone), the menu has no platform
> headings, argv checks a `Text` option's `schema` too, and errors are plain
> `Error` messages (`PromptCancelled` aside). `sync-resume/` is now
> `resume-md/`. The layout and rules below are current; later sections
> describe the earlier design, and AGENTS.md has the rules.

> **Revision (inline fixtures):** there are no `mocks.ts` or `fixtures/`
> files any more. Each test file declares its own doubles and synthetic data;
> the CLI tests are one file, `src/cli/cli.test.ts`, the
> Reactive Resume tests `src/rx-resume/index.test.ts`. The Testing section
> below is updated; generic types live in `src/utils/types.ts`.

> **Revision (removals):** `encode-cv`, `decode-cv` and `apply-job` are gone,
> with `src/cv-base64/`, `src/careers-api/` and `src/apply-job/`, along with
> the `Site` and `Job Application` platforms and `CAREERS_API_URL`. The
> site-CV merge (`sync-resume/run.ts`, `merger.ts`) is gone too:
> `src/sync-resume/` (now `src/resume-md/`) is only the `Resume.md` parser
> that the resume operations import. Every tool left is a Reactive Resume tool.

> **Revision (single-file tools):** each tool is now one file in
> `src/cli/tools/<tool>.ts` that declares its options once with `defineTool`,
> and every tool runs directly as `bun run cli <tool id> [flags]`. This removed
> each tool's `flags.ts`, `definition.ts`, `index.ts`, `mocks.ts` and
> `package.json` script. Adding `delete-rx-resume` the old way took 12 files;
> now a tool is one file plus a registry line. [Delivery](#delivery) is kept
> as the original history.

## Goal

`bun run cli` opens a terminal menu that lists every resume-tools tool, grouped
by platform. You pick a tool, answer its options and run it, without remembering
any flags. More platforms and providers will be added over time, so:

- adding a tool takes one tool file and one registry entry, plus a domain folder
  only when it has logic worth testing on its own, with no changes to the menu
  code;
- switching between interchangeable providers (e.g. DeepL ↔ Google Translate)
  takes a `.env` change, with no code changes (see [Providers](#providers)).

## Non-goals

- The portfolio repo. The CLI is run from inside `packages/resume-tools` only.
- Changing a tool's flags, output or errors. (The per-tool `bun run sync` and
  `bun run generate-rx-resume` scripts were later replaced by
  `bun run cli <tool id>`; see the revision note.)
- Path validation in flag mode. The path schema below applies only to
  interactive mode.
- A fuzzy file picker. Paths are typed in. `OptionKind.Path` leaves room for a
  picker later.
- Running several tools in one session. The CLI runs one tool and exits.
- A provider registry. It's specified below but built only when a second
  interchangeable provider exists.

## Architecture

The code is split into two layers, on top of shared utilities:

- **Domain:** what a tool does. Typed inputs, no argv, no `process`.
- **CLI:** how a tool is used from a terminal. One file per tool declares its
  options and calls the domain; a shared engine prompts, parses and runs.
- **Utils:** generic helpers with no knowledge of resumes, letters or the CLI
  (strings, records, Markdown, Zod). Helpers move here from the domain folders
  over time, so those folders hold only business logic.

The CLI depends on the domain. **Domain folders never import from `src/cli/`.**
Deleting `src/cli/` removes every terminal entry point, but the domain code
still compiles and its tests still pass. Both layers may import from
`src/utils/`; **`src/utils/` imports from neither.**

```
src/
├── resume-md/                    the Resume.md parser
│   └── parser.ts, schema.ts, types.ts   parseResume(markdown) → ParsedResume
├── rx-resume/                    the Reactive Resume platform and its tools
│   ├── index.ts                  the six tools (defineTool), RX_RESUME_TOOLS
│   ├── types.ts, schema.ts       letter metadata, CoverLetterIdSchema, the letter .md schemas
│   ├── index.test.ts             every tool through its argv, with recordingFetch
│   ├── api/                      client.ts (RxResumeApiClient), config.ts, schema.ts, types.ts
│   └── operations/
│       ├── resume/               index.ts (generate, update, delete), mapping.ts, layout.ts
│       └── cover-letter/         index.ts (generate, update, delete), parser.ts
├── utils/                        generic helpers, no domain or CLI imports
│   ├── string.ts                 slugify, splitList
│   ├── record.ts                 omitUndefined, pickNonEmptyStrings, fillDefaults
│   ├── markdown.ts               splitSections
│   ├── schema.ts                 ValidationMessage, requiredText, firstIssue, parseOrThrow
│   ├── error.ts                  describeCaught
│   └── types.ts                  ValueOf, DefaultEntry, Env, FetchFn
└── cli/
    ├── types.ts                  ToolSpec, ToolDefinition, OptionSpec, OptionValues, RunContext, Prompter
    ├── define-tool.ts            defineTool(spec) → ToolDefinition with a typed parse, the one argv parser
    ├── prompt.ts                 required → checkbox → nested prompts → argv, checking each answer
    ├── run-cli.ts                runCli: a tool by id, or the menu; returns an exit code; PromptCancelled
    ├── index.ts                  `bun run cli`: wires @inquirer/prompts, argv, env, fetch, clock, files; lists the tools
    └── cli.test.ts               drives the CLI through the registered tools
```

Rules:

- A tool declares each option once, keyed by flag, in its `defineTool` call.
  The tool's `parse` is the only place that turns argv into values. The menu
  and the direct command both go through it, so the two modes can't drift
  apart.
- Errors are plain `Error`s whose message says what to do. Only
  `PromptCancelled` is a class, so `runCli` can tell Ctrl+C apart.
- An operation takes the client and typed inputs, throws errors, and never
  reads argv, files or `process`.
- Only `src/cli/index.ts` exits the process.

Data flow for one run:

```
bun run cli:               menu → prompt-options (answers → argv) → command (print) → confirm ─┐
bun run cli <id> [flags]:  process.argv ────────────────────────────────────────────────────────┤
                                                                                                ▼
          tool.run(argv, { cwd, env }) → tool.parse(argv, cwd) → typed values → spec.run(values, { cwd, env })
```

## Types

```ts
enum Platform { ReactiveResume = "Reactive Resume" } // where a tool writes
enum OptionKind { Path = "path", Text = "text", List = "list", Choice = "choice" }
enum FileExtension { Markdown = ".md" }
enum ExitCode { Success = 0, Failure = 1, Cancelled = 130 }

interface PathRule {
  extensions: readonly FileExtension[];
  mustExist: boolean;
}

type DefaultFn = (answers: Answers) => string; // sees the answers before it

interface BaseOption {
  message: string; // prompt text
  required: boolean;
  default?: DefaultFn; // the value when left out; also shown in the checkbox
}
// A path option always carries its rule, so the compiler enforces it.
interface PathOption extends BaseOption { kind: OptionKind.Path; path: PathRule }
interface ValueOption extends BaseOption { kind: OptionKind.Text | OptionKind.List }
interface ChoiceOption extends BaseOption { kind: OptionKind.Choice; choices: readonly string[] }
type OptionSpec = PathOption | ValueOption | ChoiceOption;
type OptionSpecs = Readonly<Record<string, OptionSpec>>; // keyed by flag, in prompt order

// What run receives: a List is string[], a Choice the union of its choices,
// others string; `| undefined` unless the option is required, has a default,
// or is a List ([] when absent).
type OptionValues<TOptions extends OptionSpecs> = { … };

interface RunContext { cwd: string; env: Env }

// What a tool file writes
interface ToolSpec<TOptions extends OptionSpecs> {
  id: string; // also the first argument: `bun run cli <id>`
  title: string;
  description: string;
  platform: Platform;
  options: TOptions;
  preflight?: (env: Env) => string | undefined; // reason the tool can't run
  run: (values: OptionValues<TOptions>, context: RunContext) => Promise<void>;
}

// What defineTool returns, and all the menu and run-cli ever see
interface ToolDefinition<TValues extends ResolvedValues = ResolvedValues> {
  id, title, description, platform, preflight;
  command: string; // "bun run cli <id>", used in the printed command
  usage: string; // built from the options
  options: readonly OptionDescriptor[]; // OptionSpec & { flag }
  parse(argv: readonly string[], cwd: string): TValues; // argv → typed values, no run
  run(argv: readonly string[], context: RunContext): Promise<void>; // parse → spec.run
}

// The one error the CLI throws: a reason per code, worded in errors.ts
type CliErrorReason =
  | { code: CliErrorCode.MissingOption; flag; placeholder; usage }
  | { code: CliErrorCode.InvalidChoice; flag; choices }
  | { code: CliErrorCode.UnderivableDefault; flag; source }
  | { code: CliErrorCode.PromptCancelled };
class CliError<TReason extends CliErrorReason> extends ReasonedError<TReason> {}
```

`defineTool` has a `const` type parameter, so option kinds and `required: true`
are inferred as literals and `run`'s values are typed without annotations. It
returns `ToolDefinition<OptionValues<TOptions>>`, so a tool's `parse` is typed
too; the registry erases that to `ToolDefinition`. Its one `as` cast is in
`parseToolArgs`, which builds the values object key by key.

`parse` works in three steps, each with its own data:

1. **answers:** the flags given on argv, then each missing option's default
   (`fillDefaults`, in declaration order, each seeing the answers before it).
2. **checks:** every required option has an answer, every choice a valid one;
   otherwise a `CliError` (`MISSING_OPTION`, `INVALID_CHOICE`).
3. **values:** each answer converted for its kind: absolute paths, split
   lists, the choice's union.

`Prompter` uses the CLI's own types, including its own separator choice. Only
`src/cli/index.ts` imports `@inquirer/prompts`. It adapts the library to
`Prompter`, mapping separator choices to `new Separator()` and rethrowing
`ExitPromptError` as a CLI-owned `CliError` with code `PROMPT_CANCELLED`.
`run-cli.ts` never imports the library.

UI strings (`"Run it?"`, `"Exit"`, `"Cancelled."`, and so on) live in one
`CliLabel` enum in `types.ts`. Fixed sets are plain `enum`s, not `const enum`:
Bun and Vitest transpile each file on its own, and they can't inline a
`const enum` imported from another module.

## Behaviour

### 1. Start

If argv names a tool (`bun run cli <id> [flags]`), run it directly: no menu, no
prompts, no terminal needed. An unknown id prints
`Unknown tool "<id>". Run one of:` and every tool's usage, and returns
`ExitCode.Failure`.

Otherwise, if `isTTY` is false, print the following and return
`ExitCode.Failure`:

```
resume-tools cli needs an interactive terminal. Run a tool directly:
  <tool.usage for each registered tool>
```

### 2. Menu

`select` over the registry, grouped by platform in `Platform` order (built with
`filter`, so the registry is never reordered in place), with a separator heading
per platform and an `Exit` entry at the end:

```
── Reactive Resume ──
  Generate resume — create a resume via the API  Not available: Missing RXRESUME_API_KEY, …
```

A tool whose `preflight(env)` returns a reason is shown with that reason as
`disabled`, and can't be selected. Choosing `Exit` returns `ExitCode.Success`.

### 3. Options

1. Prompt for each `required` option, in order.
2. If the tool has optional options, show a `checkbox`: "Set any optional
   flags?" Each entry shows its `default` when it has one.
3. Prompt for each ticked option.
4. Turn the answers into argv: `["--id", "<id>", "--resume", …]`. Leave
   out unticked optional flags so the tool applies its own defaults.

Per kind:

| Kind     | Prompt   | Validation                    | Argv value                |
| -------- | -------- | ----------------------------- | ------------------------- |
| `Path`   | `input`  | `pathSchema`, see below       | as typed                  |
| `Text`   | `input`  | non-empty when required       | trimmed text              |
| `List`   | `input`  | none                          | comma-separated, as typed |
| `Choice` | `select` | none: a select can't be wrong | the picked value          |

A `Choice` declares its values in `choices`, and `run` receives their union,
not `string`. In flag mode, `parseToolArgs` rejects any other value with
`--template must be one of azurill, …`. The cover-letter tools' `--template`
is the only one.

### 4. Path schema (interactive only)

`pathSchema(rule, { cwd, exists })` is a Zod schema. `exists` is passed in, so
tests need no real files. It checks in this order and stops at the first
failure:

| Input       | Message                                      |
| ----------- | -------------------------------------------- |
| `""`        | `A path is required`                         |
| `Resume`    | `Missing file extension — expected .md`      |
| `Resume.cp` | `Unsupported format ".cp" — expected .md`    |
| `nope.md`   | `File not found: nope.md` (only `mustExist`) |

It only validates: argv carries the path as typed, and `parseToolArgs` resolves
it from the same `cwd`, exactly as in direct mode. The prompt's `validate` runs
`safeParse` and returns the first issue's message.

Rules per tool:

| Tool                  | Option       | Extensions           | mustExist | Required |
| --------------------- | ------------ | -------------------- | --------- | -------- |
| generate-rx-resume    | `--resume`   | `.md`                | yes       | yes      |
| update-rx-resume      | `--resume`   | `.md`                | yes       | yes      |
| generate-cover-letter | `--letter`   | `.md`                | yes       | yes      |
| update-cover-letter   | `--letter`   | `.md`                | yes       | yes      |

Generate's other options: `--name` (`Text`, required), `--slug` (`Text`,
optional, default `slugify(name)`) and `--tags` (`List`, optional). Update
and delete each take `--id` (`Text`, required). The cover-letter tools take `--name`, `--resume-id`,
`--application-id`, `--company` (`Text`) and `--template` (`Choice` of the 17
template names); see [cover-letter.md](cover-letter.md#cli).

### 5. Confirm

Print the equivalent flag command, with values as typed and any value the shell
would split or expand (spaces, quotes, `$`) wrapped in double quotes:

```
bun run cli generate-rx-resume --resume resume/Resume.md --name "Jane Doe"
? Run it? (Y/n)
```

`No` returns to the menu (step 2). `Yes` calls `tool.run(argv)`.

### 6. Exit

| Outcome              | Output                    | Exit code |
| -------------------- | ------------------------- | --------- |
| Tool succeeded       | the tool's own output     | `0`       |
| Tool threw           | `error.message`, no stack | `1`       |
| Ctrl+C at any prompt | `Cancelled.`              | `130`     |

`runCli` returns the code. `src/cli/index.ts` calls `process.exit` with it.

### Preflight: Reactive Resume tools

`generate-rx-resume`, `update-rx-resume`, `delete-rx-resume` and the three
cover-letter tools use `apiConfigProblem(env)` from `src/rx-resume/config.ts`. It calls
`resolveApiConfig(env)` and returns the error's message when it throws, or
`undefined` when it doesn't. Bun loads `.env` from the package root, because
`bun run cli` runs there.

## Providers

A **provider** is an external service that can be swapped for another one that
does the same job, such as DeepL and Google Translate. A **destination** is
where a tool writes, such as Reactive Resume. Destinations get
their own tools and their own `Platform` entry. Providers never appear in
`Platform`, in a tool file or in a domain `run.ts`, so swapping one never
touches them.

The pattern is ports and adapters
([Cockburn](https://alistair.cockburn.us/hexagonal-architecture/)), with the
adapter chosen by configuration
([Fowler, Plugin](https://martinfowler.com/eaaCatalog/plugin.html)). The Vercel
AI SDK's
[`createProviderRegistry`](https://ai-sdk.dev/docs/reference/ai-sdk-core/provider-registry)
uses the same shape in a widely used TypeScript SDK.

```
src/translate-resume/                 domain (example tool)
  types.ts      interface Translator { translate(texts, target: Language): Promise<string[]> }   ← port
  translate.ts  translateResume(parsed, target, translator)
  run.ts        runTranslate(options, translator)
src/providers/translator/
  deepl.ts      deepl: TranslatorProvider = { id, envVars, create(env): Translator }   ← adapter
  google.ts     google: TranslatorProvider
  registry.ts   TRANSLATORS = [deepl, google]
                resolveTranslator(env)              ← picks TRANSLATOR=… if its envVars are set
                translatorUnavailableReason(env)    ← used by the tool's preflight
src/cli/tools/translate-resume.ts
  platform: Platform.Translation
  run: (values, { env }) => runTranslate(values, resolveTranslator(env))
```

Rules:

- The port (the interface) lives in the domain folder that uses it. Domain code
  sees only the port.
- One file per provider holds its config, client, response schema, and the map
  from the domain's neutral enums (e.g. `Language`) to the vendor's codes.
  Vendors differ: DeepL uses `PT-BR` and `ZH-HANS`, while Google uses `pt-BR`
  and `zh-CN`.
- `fetch` is passed into every client, so its tests use a fake `fetch`, as
  `src/rx-resume/client.ts` already does.
- Until a second provider exists, skip the registry: keep a single adapter
  behind one `resolveX(env)` function, so adding the registry later changes only
  that function.

What a change touches:

| Change                            | Files touched                         |
| --------------------------------- | ------------------------------------- |
| Switch between existing providers | `.env` only (`TRANSLATOR=google`)     |
| Add a provider                    | 1 new provider file + 1 registry line |
| Remove a provider                 | delete 1 file + 1 registry line       |
| Domain logic, menu, other tools   | nothing                               |

## Setup

- Dependency: `@inquirer/prompts`.
- One script in `package.json`: `"cli": "bun src/cli/index.ts"`. It opens the
  menu, or runs a tool directly when given its id.
- Paths typed at the prompts resolve from the package root.

## Testing

Per AGENTS.md: write each test before its implementation (red → green), and keep
tests next to their modules. **Cover base cases only**: one happy path and the
main failure for each unit. Don't build exhaustive edge-case matrices.

- No `mocks.ts` or fixture files: each test file declares its doubles and
  synthetic data inline. Tests that would share them sit in one file per
  surface, e.g. `cli/tools/rx-resume/cli.test.ts` holds the fake prompter,
  harness, env objects, prompt scripts and expected usage lines.
- CLI tests run the real tools from the registry, never tools built for the
  test. Where a test must not do a tool's work, `withRecordedRuns(tool)` keeps
  its declaration and records its argv instead.
- The fake prompter answers from a script keyed by prompt message, and throws on
  any unscripted prompt.
- There are no real-terminal tests. Tool files get no unit tests of their
  own, because their logic is already covered by the parser and Reactive
  Resume tests.
- Tool files get no test files of their own. `cli.test.ts` checks every
  registered tool (usage line, menu placement, preflight, missing flags
  rejected before any work) and covers parsing through real tools, and the
  domain tests cover their work.

| Test file                                       | Base cases                                                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `cli/tools/rx-resume/cli.test.ts`               | `pathSchema`; parse (defaults, lists, missing/unknown flag, choices, run); prompts; every tool's menu line, usage, preflight and missing flags; `runCli` exit codes |
| `cli/command.test.ts`                           | argv appended; value with a space is quoted                                                                                           |
| `rx-resume/config.test.ts` (`apiConfigProblem`) | returns the reason; returns `undefined` when set                                                                                      |
| `rx-resume/patch.test.ts`                       | patched data saved under the same id; failed fetch saves nothing                                                                      |

## Delivery

Branch `bac-49-integrate-cli-user-friendly-utility`. Commit messages follow
caveman-commit.

1. This spec.
2. Refactor, no behaviour change:
   - Move the work in each `index.ts` into a domain `run.ts` that takes typed
     options. For sync, move the module-level `paths` into `runSync` and pass
     the CV path into `parseFrontmatter` as a parameter.
   - Move each `cli.ts` (and its test) to `src/cli/tools/<tool>/flags.ts`.
   - Move each `index.ts` shim to `src/cli/tools/<tool>/index.ts`.
   - Update the `sync` and `generate-rx-resume` script paths.
3. CLI core: types, schema, command, prompt-options, menu, run-cli, mocks.
4. Tool definitions, registry, the `cli` script, and a README section
   ("Interactive CLI", "Adding a tool", "Adding a provider").

## Adding a tool later

1. Create `src/cli/tools/<tool>.ts` exporting
   `defineTool({ id, title, description, platform, options, preflight?, run })`.
   Put any external service behind a port (see [Providers](#providers)).
2. Append it to `TOOLS` in `src/cli/registry.ts`. It is then in the menu and
   runs as `bun run cli <id>`.
3. If the tool has logic worth testing on its own, put it in a domain folder
   `src/<tool>/` with a `run.ts` that takes typed options, tested first.
4. Add a `Platform` entry only if the tool writes to a new destination or does a
   new kind of job. Never add one for a vendor.
