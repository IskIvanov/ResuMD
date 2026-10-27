# Spec: Interactive CLI

Linear:
[BAC-49](https://linear.app/bck123/issue/BAC-49/integrate-cli-user-friendly-utility)
· Follow-up:
[BAC-53](https://linear.app/bck123/issue/BAC-53/move-test-fixtures-into-one-mocksts-per-tool-folder)

> **Revision (single-file tools):** each tool is now one file in
> `src/cli/tools/<tool>.ts` that declares its options once with `defineTool`,
> and every tool runs directly as `bun run cli <tool id> [flags]`. This removed
> each tool's `flags.ts`, `definition.ts`, `index.ts`, `mocks.ts` and
> `package.json` script. Adding `delete-rx-resume` the old way took 12 files;
> now a tool is one file plus a registry line. The sections below describe the
> current design; [Delivery](#delivery) is kept as the original history.

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
├── sync-resume/                  domain
│   ├── parser.ts, merger.ts, render-json.ts, schema.ts, types.ts
│   └── run.ts                    runSync(paths: SyncPaths, cwd: string): Promise<void>
├── generate-rx-resume/           domain
│   ├── generate.ts, types.ts
│   └── run.ts                    runGenerate(options: GenerateOptions, env: Env): Promise<void>
├── update-rx-resume/             domain
│   ├── types.ts
│   └── run.ts                    runUpdate(options: UpdateOptions, env: Env): Promise<void>
├── rx-resume/                    Reactive Resume adapter: RxResumeApiClient (resumes and cover letters), config
│                                 (incl. apiConfigProblem), schema, patch (patchResumeData: get → patch → put)
├── cover-letter/                 domain
│   ├── parser.ts, body.ts, schema.ts, types.ts   parseCoverLetter, toCreateBody, toUpdateBody
│   ├── generate.ts, update.ts, delete.ts         create; get → put at the revision; get → trash → purge
│   ├── errors.ts                 CoverLetterError (NOT_FREEFORM, LEFT_IN_TRASH)
│   └── run.ts                    runGenerateCoverLetter, runUpdateCoverLetter, runDeleteCoverLetter
├── utils/                        generic helpers, no domain or CLI imports
│   ├── string.ts                 slugify, splitList, kebabToCamel (+ KebabToCamel type)
│   ├── record.ts                 omitUndefined, pickNonEmptyStrings, fillDefaults, camelCaseKeys
│   ├── markdown.ts               splitSections
│   ├── schema.ts                 ValidationMessage, requiredText, formatIssuePath, parseOrThrow
│   ├── url.ts                    trimTrailingSlashes, itemPath
│   ├── error.ts                  ReasonedError, the base of every error the tools own
│   └── type.ts                   ValueOf
└── cli/
    ├── types.ts                  ToolSpec, ToolDefinition, OptionSpec, OptionValues, Prompter, enums
    ├── define-tool.ts            defineTool(spec) → ToolDefinition with a typed parse, the one argv parser
    ├── errors.ts                 CliError (one class, a typed reason per CliErrorCode), isCliError
    ├── schema.ts                 pathSchema
    ├── command.ts                formats the equivalent direct command
    ├── prompt-options.ts         required → checkbox → nested prompts → argv
    ├── menu.ts                   builds the menu choices from the registry
    ├── run-cli.ts                orchestrator: a tool by id, or the menu; returns an exit code
    ├── registry.ts               TOOLS: readonly ToolDefinition[]
    ├── mocks.ts                  fixtures for the CLI tests, built on the registered tools
    ├── index.ts                  `bun run cli`: wires @inquirer/prompts, argv, process.env, existsSync
    └── tools/
        ├── sync-resume.ts        options + run: (paths, { cwd }) => runSync(paths, cwd)
        ├── generate-rx-resume.ts options + run: (options, { env }) => runGenerate(options, env)
        ├── update-rx-resume.ts   options + run: (options, { env }) => runUpdate(options, env)
        ├── delete-rx-resume.ts   options + run: client.deleteResume(id), no domain folder
        └── generate-cover-letter.ts, update-cover-letter.ts, delete-cover-letter.ts
                                  options + run: (values, { env }) => run…CoverLetter(camelCaseKeys(values), env)
```

Rules:

- A tool declares each option once, keyed by flag, in its `defineTool` call.
  The tool's `parse` is the only place that turns argv into values. The menu
  and the direct command both go through it, so the two modes can't drift
  apart.
- The CLI throws only `CliError`, with a typed reason, never a bare `Error`.
  The message is worded in `errors.ts` from the reason.
- A domain `run.ts` takes typed options, throws errors, and never reads argv or
  calls `process.exit`. A tool that only calls one API endpoint needs no domain
  folder.
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
enum Platform { Site = "Site", ReactiveResume = "Reactive Resume" } // where a tool writes
enum OptionKind { Path = "path", Text = "text", List = "list", Choice = "choice" }
enum FileExtension { Markdown = ".md", Json = ".json" }
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
── Site ──
❯ Sync resume — update the site CV and RxResume JSON
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
4. Turn the answers into argv: `["--cv", "<abs path>", "--resume", …]`. Leave
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
is the first one.

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
| sync                  | `--cv`       | `.md`                | yes       | yes      |
| sync                  | `--resume`   | `.md`                | yes       | yes      |
| sync                  | `--json`     | `.json`              | no        | no       |
| sync                  | `--template` | `.json`              | yes       | no       |
| generate-rx-resume    | `--resume`   | `.md`                | yes       | yes      |
| update-rx-resume      | `--resume`   | `.md`                | yes       | yes      |
| generate-cover-letter | `--letter`   | `.md`                | yes       | yes      |
| update-cover-letter   | `--letter`   | `.md`                | yes       | yes      |

Generate's other options: `--name` (`Text`, required), `--slug` (`Text`,
optional, default `slugify(name)`) and `--tags` (`List`, optional). Sync's
defaults for `--json` and `--template` are `DefaultPath` resolved from the
package root. Update and delete each take `--id` (`Text`, required). The
cover-letter tools take `--name`, `--resume-id`, `--application-id`,
`--company` (`Text`) and `--template` (`Choice` of the 17 template names); see
[cover-letter.md](cover-letter.md#cli).

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
where a tool writes, such as the site CV or Reactive Resume. Destinations get
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
- The portfolio's `resume:sync` script runs
  `bun packages/resume-tools/src/cli/index.ts sync-resume --cv … --resume …`.

## Testing

Per AGENTS.md: write each test before its implementation (red → green), and keep
tests next to their modules. **Cover base cases only**: one happy path and the
main failure for each unit. Don't build exhaustive edge-case matrices.

- One `mocks.ts` per folder: `src/cli/mocks.ts` for the CLI tests (fake
  prompter, env objects, prompt scripts and expected usage lines for the
  registered tools). They hold typed constants and small factories only: no
  assertions and no `vi.fn()` setup. Tests import from them and never declare
  fixtures inline.
- CLI tests run the real tools from the registry, never tools built for the
  test. Where a test must not do a tool's work, `withRecordedRuns(tool)` keeps
  its declaration and records its argv instead.
- The fake prompter answers from a script keyed by prompt message, and throws on
  any unscripted prompt.
- There are no real-terminal tests. The domain `run.ts` files get no new unit
  tests, because their logic is already covered by the parser, merger and
  generate tests.
- Tool files get no test files of their own. `registry.test.ts` checks every
  registered tool (usage line, menu placement, preflight, missing flags
  rejected before any work), `define-tool.test.ts` covers parsing through
  real tools, and the domain tests cover their work.

| Test file                                       | Base cases                                                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `cli/schema.test.ts`                            | valid path passes; wrong extension; not found                                                                                         |
| `cli/command.test.ts`                           | argv appended; value with a space is quoted                                                                                           |
| `cli/prompt-options.test.ts`                    | required only; one optional flag ticked; choice offered in a select                                                                   |
| `cli/menu.test.ts`                              | one separator per platform; disabled reason; `Exit` entry                                                                             |
| `cli/define-tool.test.ts`                       | path + default; given value + list; missing flag; unknown flag; choice parsed and typed; invalid choice; usage; run parses first      |
| `cli/registry.test.ts`                          | every tool: menu layout, usage line, disabled until `.env` has its settings, missing flags rejected; cover-letter tools in order      |
| `cli/run-cli.test.ts`                           | non-TTY → 1; Exit → 0; success → 0; tool throws → 1; cancel → 130; direct run; unknown id                                             |
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
