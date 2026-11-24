# AGENTS.md

Guidance for working in `resume-tools`. See [README.md](README.md) for user docs
and [docs/interactive-cli.md](docs/interactive-cli.md) for the CLI design.

## What this is

A Bun + TypeScript (ESM, strict) CLI that keeps one `Resume.md`, hand-edited or
downloaded as Reactive Resume's Markdown export, and syncs it into Reactive
Resume via its API. A
cover-letter `.md` drives a Reactive Resume cover letter the same way.

This folder is a standalone private repo (`IskIvanov/Resume-Tools`) cloned into
`packages/resume-tools/` of the Portfolio repo, which gitignores it. Run `git`
here against this repo's own history. It holds code and templates only, never a
real `Resume.md`.

## Commands

```bash
bun install
bun run cli                  # interactive menu
bun run cli <tool> [flags]   # run one tool directly
bun run test                 # vitest (watch mode; use `bunx vitest run` for one pass)
bunx vitest run src/utils/string.test.ts -t slugify   # one file / one test
bun run typecheck            # tsc --noEmit
bun run format               # biome format --write . (formatter only, linter off)
bunx knip                    # unused files, exports and dependencies (CI runs it)
```

Style (biome): 2 spaces, 80 cols, double quotes, semicolons, trailing commas.
Imports use explicit `.ts` extensions.

## Architecture

Two layers, on shared utilities:

- `src/cli/`: the CLI engine. It knows nothing about resumes or letters.
  - `define-tool.ts`: `defineTool({ id, platform?, title, description,
    options, preflight?, run })` turns one declaration into the menu prompts,
    the usage line and the argument parser, so the menu and
    `bun run cli <tool>` can't drift. Each option is declared once, keyed by
    flag, with a `kind` (`Path`, `Text`, `List`, `Choice`), `required`,
    optional `default(answers)`, path rules or `choices`. A `Choice` is a
    select in the menu, rejected in the tool arguments unless it's one of
    `choices`, and `run` gets the union of its values. A `Text` option can
    add a Zod `schema`, checked at the prompt and in the tool arguments, and
    `secret: true`, which types it hidden and prints it as `••••••••`.
  - `platform` is a label, not a type: the menu's first level lists each
    platform in order of first appearance, then the tools without one, then
    Exit; picking a platform lists its tools, then Back and Exit. Nothing
    else about a tool depends on it.
  - `prompt.ts` (answers → tool arguments, checking paths and schemas as
    typed), `run-cli.ts` (`runCli`: a tool by id, or the two-level menu;
    reads the saved settings first; `PromptCancelled`),
    `types.ts` (`OptionKind`, `ToolDependencies`, `CliDependencies`, …).
  - `index.ts` is the entry point and the registry: the only file that
    touches the real terminal, network, clock and file system, and the one
    place each platform's tool list is spread in.
  - A tool's `run(values, dependencies)` gets `ToolDependencies`:
    `workingDirectory`, `environmentVariables`, `fetch`, `newId`, `today`,
    `now`, `readFile`, `exists`, `writeFile`, `settingsFile`,
    `writePrivateFile` (readable only by the user), `log`, `logError`.
  - `preflight(environmentVariables)` returns a reason string when a tool
    can't run (e.g. missing API key); the menu lists it as disabled.
  - Exit codes: `0` ok, `1` failure, `130` cancelled.
- `src/<platform>/`: a destination such as Reactive Resume, together with its
  tools; see Platform and Operation in `docs/GLOSSARY.md`. It imports the CLI
  only for `defineTool` and its types.
  - `index.ts` declares the platform's tools, each labelled with the
    platform, and exports their list (`RX_RESUME_TOOLS`), Connect first;
    `types.ts` and `schema.ts` hold what the tools and operations share.
  - `api/`: the client, the settings Connect saves, and the API's schemas
    and types.
  - `operations/<thing>/`: create, update and delete, as functions that take
    the client. They never read tool arguments, files or `process`.
- `src/resume-md/`: the `Resume.md` parser, shared by any platform, and the
  tools that need no platform (`RESUME_MD_TOOLS`), such as `example-resume`.

Both layers sit on `src/utils/`: generic helpers (strings, records, Markdown,
Zod) that know nothing about resumes, letters or the CLI. It imports only
Node built-ins and libraries, never `src/cli/` or a domain folder. One file
per topic (`string.ts`, `record.ts`, `markdown.ts`, `schema.ts`), tests
colocated. A helper belongs here once two folders use it; a helper with one
caller stays in that caller's file.

| Folder       | Role |
| ------------ | ---- |
| `resume-md/` | `parser.ts` (only `parseResumeMd`: reads Resume.md once into typed logical lines, see `docs/GLOSSARY.md`; `classifyLine` is the only place that decides a line's kind), `schema.ts` (Zod validation), `types.ts`. `index.ts` (`example-resume`, `RESUME_MD_TOOLS`), `example.ts` (Jane Doe's Resume.md, as a string). `index.test.ts`: `example-resume` through its tool arguments, with in-memory files |
| `rx-resume/` | The Reactive Resume platform. `index.ts` (`connect-rx-resume` and the seven document tools, `RX_RESUME_TOOLS`), `types.ts` (cover-letter text and letter fields), `schema.ts` (`AddressSchema`, `CoverLetterIdSchema`, the letter `.md` schemas). `api/`: `client.ts` (`RxResumeApiClient` with editor links and `checkApiKey`, `RxResumeApiError`), `settings.ts` (`isConnected`, `settingsFor`, `replaceSavedSettings`, `connectRxResume(environmentVariables, fetch, apiCallLog)`), `schema.ts` (API shapes), `types.ts`. `operations/resume/`: `index.ts` (`createResume`, `updateResume`, `previewResumeUpdate`, `deleteResume`), `mapping.ts` (ResumeMd → API `data`, keeping hidden items and what matched stored items hold), `changes.ts` (`compareSections`, `assertNoSectionEmptied`), `layout.ts`. `operations/cover-letter/`: `index.ts` (create, update, delete), `parser.ts`. `index.test.ts`: every tool through its tool arguments, with `recordingFetch`, in-memory files and a stand-in for the Markdown export |
| `utils/`     | `string.ts` (`slugify`, `splitList`), `record.ts` (`omitUndefined`, `pickNonEmptyStrings`, `fillDefaults`), `markdown.ts` (`splitSections`), `schema.ts` (`FieldProblem`, `requiredText`, `firstIssue`, `parseOrThrow`), `error.ts` (`describeCaught`), `types.ts` (`ValueOf`, `DefaultEntry`, `EnvironmentVariables`, `FetchFunction`) |

Data flow: `Resume.md` → `create-resume` / `update-resume` →
`createResume` / `updateResume` → `parseResumeMd` (Zod-validated; errors name
paths like `jobs[2].role: required`) → `applyResumeMd` →
`assertNoSectionEmptied` (updates only) → Reactive Resume API. A
cover-letter `.md` → `create-cover-letter` / `update-cover-letter` →
`parseCoverLetter` (`## Recipient`, `## Letter`, `## Sign-off`; errors like
`signOff: required`) → the request, checked against the API's schema →
the cover-letter endpoints.

Gotchas:

- `resume-md/` is not a platform: it holds the `Resume.md` parser that
  `rx-resume/operations/resume/` imports, and the tools that need no
  platform.
- `parseResumeMd` reads both the hand-written format and Reactive Resume's
  Markdown export, except that bullets are always `- text`: a `• ` line throws.
  The export holds only visible content, so `update-resume` must keep what it
  can't show; see `docs/resume-md.md`.
- The CLI tests that drive the menu, argument parsing, prompts and `runCli` live
  in one file, `src/cli/cli.test.ts`, with their doubles (fake prompter,
  harness, `withRecordedRuns`). They use the Reactive Resume tools, so
  removing that platform means pointing them at another one.
- Settings: `RXRESUME_API_KEY`, `RXRESUME_API_URL`, `RXRESUME_APP_URL`,
  optional `RXRESUME_DEBUG` (logs every API call to stderr, never the key).
  `connect-rx-resume` tests the key, then saves the first three to
  `~/.config/resume-tools/.env` (mode 600), replacing only its own lines.
  `runCli` reads that file with `parseEnv` and lays `process.env` over it:
  shell variables, then a `.env` in the current folder (Bun loads it), then
  the saved file. An empty value never hides a saved one.
- `.gitignore` blocks every `*.md` except `README.md`, `docs/`, `AGENTS.md`,
  `CLAUDE.md` and `.agents/skills/`.
- Skills and hooks live in `.agents/` (`skills/<name>/`, `hooks/`), but
  Claude Code reads neither there: it loads skills only from `.claude/skills/`
  and hooks only from `.claude/settings.json`. So each skill has a symlink
  `.claude/skills/<name> -> ../../.agents/skills/<name>`, and
  `.claude/settings.json` runs the hook scripts by their `.agents/hooks/`
  path.
- Gitignored personal data: `resume/RxResume/Resume.json`, `*.base64.txt`,
  `*.pdf`, `*.docx`, `.env*`.

## Conventions

- Zod schemas live in each folder's `schema.ts`; infer data types with
  `z.infer` in `types.ts`. Hand-write types only for non-data (options, clients).
- Fixed value sets (option kinds, environment variable names, API values) use enums or
  `as const` objects. UI strings are written inline where they're used; give
  one a constant only when two places must agree.
- Explicit parameter and return types; every exported function gets JSDoc with
  `@param`, `@returns`, `@example`, and `@throws` where relevant.
- Inject dependencies (`fetch`, `environmentVariables`, `workingDirectory`, the
  clock, file reads) through `ToolDependencies` rather than reading globals.
- No ternaries: use `if`/`else` (early returns) or `switch`.
- Throw `Error` with a message that says what went wrong and what to do, and
  pass the underlying error as `cause`. The only error classes are
  `PromptCancelled` (Ctrl+C) and `RxResumeApiError` (the API's `status` and
  `code`), since callers tell those apart.
- Descriptive names, readable at a glance:
  - No `stub`, single-letter (including callback parameters and mapped-type
    keys) or catch-all names (`context`, `given`).
  - No abbreviations a reader has to decode (`argv`, `ctx`, `env`, `cwd`,
    `md`, `deps`, `Fn`, `Idx`): name what the value is for, e.g.
    `toolArguments`, `environmentVariables`, `workingDirectory`, `markdown`.
  - Name what a request, response, body or parse result carries, not its
    mechanism: `newLetter`, `changes`, `httpResponse`, `resumeMd`, not
    `body`, `request`, `response`, `parsed` or `config`.
  - Domain names follow `docs/GLOSSARY.md`, and Reactive Resume's words
    stay inside `src/rx-resume/`.
  - The CLI's terms (spec, option, tool arguments, answers, values,
    dependencies) are defined at the top of `src/cli/types.ts`.
- Tests: Vitest, colocated as `foo.test.ts`. No `mocks.ts` or fixture files:
  each test file declares its own doubles and synthetic data (Jane Doe, Acme
  BV, never a real resume or letter), and tests that would share them live in
  one file per surface. Write the test first. CLI tests use the registered
  tools, never tools built for the test (`withRecordedRuns` swaps only a
  tool's `run`).
- TDD: before writing any test, load the `tdd` skill
  (`.agents/skills/tdd/`), confirm the seams under test with the user, then
  work one red → green slice at a time. No logic without a failing test
  first. A hook (`.agents/hooks/tdd-gate.sh`) denies edits to `*.test.ts`
  until the skill is loaded in the session.

## Adding a tool

1. Declare it with `defineTool(...)` in `src/<platform>/index.ts`, with the
   platform's `platform` label, and append it to the platform's tool list.
   A tool that needs no platform leaves `platform` out and goes in
   `src/resume-md/index.ts` and `RESUME_MD_TOOLS`. `run` throws on failure,
   reads files with `dependencies.readFile` and prints with
   `dependencies.log`.
2. Put its API calls in `src/<platform>/operations/<thing>/index.ts`, as
   functions that take the client.
3. Test it first through its tool arguments (for Reactive Resume: `runTool` with
   `recordingFetch`, in `src/rx-resume/index.test.ts`; for a tool without a
   platform, `src/resume-md/index.test.ts`).
4. A new platform's tool list is spread into `tools` in `src/cli/index.ts`,
   before `RESUME_MD_TOOLS`, with a Connect tool first that saves its
   settings.

## Removing a platform

1. `rm -r src/<platform>`.
2. Drop its import and spread in `src/cli/index.ts`, and its `.env.example`
   variables.
3. If it was the platform `src/cli/cli.test.ts` drives, point those tests at
   another platform's tools.
4. `bun run typecheck && bunx vitest run` pass with nothing else changed.
