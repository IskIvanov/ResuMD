# AGENTS.md

Guidance for working in `resume-tools`. See [README.md](README.md) for user docs
and [docs/interactive-cli.md](docs/interactive-cli.md) for the CLI design.

## What this is

A Bun + TypeScript (ESM, strict) CLI that keeps one hand-edited `Resume.md` as
the source of truth and syncs it into Reactive Resume via its API. A
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
```

Style (biome): 2 spaces, 80 cols, double quotes, semicolons, trailing commas.
Imports use explicit `.ts` extensions.

## Architecture

Two layers:

- `src/cli/` — argv/menu plumbing. Never holds domain logic beyond a thin tool
  file.
  - `tools/<platform>/<tool>.ts` declares one tool with `defineTool({ id, title,
    description, platform, options, preflight?, run })`. Each option is
    declared once, keyed by flag, with a `kind` (`Path`, `Text`, `List`,
    `Choice`), `required`, optional `default(given)`, path rules or
    `choices`. A `Choice` is a select in the menu, rejected in argv unless
    it's one of `choices`, and `run` gets the union of its values. A `Text`
    option can add a Zod `schema`, checked at the prompt and in argv.
  - `define-tool.ts` derives the menu prompts, usage line and argv parser from
    that declaration, so the menu and `bun run cli <tool>` can't drift.
  - `tools/<platform>/index.ts` exports that platform's tools in menu order
    (`RX_RESUME_TOOLS`); `registry.ts` spreads each list into `TOOLS`.
  - `menu.ts`, `run-cli.ts`, `command.ts`, `prompt-options.ts`, `schema.ts`,
    `errors.ts`, `types.ts` (`Platform`, `OptionKind`, `CliLabel` enums).
  - `preflight(env)` returns a reason string when a tool can't run (e.g.
    missing API key); the menu lists it as disabled.
  - Exit codes: `0` ok, `1` failure, `130` cancelled.
- `src/<domain>/` — testable logic. Must not read argv or import from
  `src/cli/`. A **platform** (a destination such as Reactive Resume) is a
  domain module imported only through its `index.ts`, plus its tools in
  `src/cli/tools/<platform>/`; see Platform and Operation in
  `docs/GLOSSARY.md`. `src/cli/platforms.test.ts` fails on any import that
  reaches past those seams.

Both layers sit on `src/utils/`: generic helpers (strings, records, Markdown,
Zod) that know nothing about resumes, letters or the CLI. It imports only
Node built-ins and libraries, never `src/cli/` or a domain folder. One file
per topic (`string.ts`, `record.ts`, `markdown.ts`, `schema.ts`), tests
colocated. Helpers are migrating here gradually: when you touch a domain or
CLI file and find a generic helper in it, or one domain importing a helper
from another, move it to `src/utils/` and update its callers (no re-exports).

| Folder                | Role                                                                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sync-resume/`        | `parser.ts` (only `parseResume`: reads Resume.md once into typed logical lines, see `docs/GLOSSARY.md`), `schema.ts` (Zod validation), `types.ts` |
| `rx-resume/`          | The Reactive Resume platform. `index.ts` is the only import path from outside: `connectRxResume({ env, fetch, newId, today })` returns `{ resumes, coverLetters }`, each with `generate`, `update` and `delete`; `rxResumeProblem` is the preflight. Behind it: `client.ts` (`RxResumeApiClient`, injected `fetch`), `config.ts` (`.env`), `errors.ts` (`RxResumeError`), `schema.ts` (API shapes), `resume/` (`operations.ts`, `mapping.ts`: ParsedResume → API `data`, `layout.ts`), `cover-letter/` (`operations.ts`, `parser.ts`, `body.ts`, `update.ts`, `delete.ts`), `index.test.ts` (every operation through `connectRxResume`, with `recordingFetch` and the synthetic resume and letter) |
| `utils/`              | `string.ts` (`slugify`, `splitList`, `kebabToCamel`), `record.ts` (`omitUndefined`, `pickNonEmptyStrings`, `fillDefaults`, `camelCaseKeys`), `markdown.ts` (`splitSections`), `schema.ts` (`ValidationMessage`, `requiredText`, `formatIssuePath`, `parseOrThrow`), `url.ts` (`trimTrailingSlashes`, `itemPath`), `error.ts` (`ReasonedError`, `describeCaught`, `failureOf`), `types.ts` (`ValueOf`, `KebabToCamel`, `CamelCaseKeys`, `DefaultEntry`, `ErrorReason`, `Env`, `FetchFn`) |

Data flow: `Resume.md` → `parseResume` (Zod-validated; errors name paths like
`jobs[2].role: required`) → `rx.resumes.generate` / `update` →
`applyResume` → Reactive Resume API. A
cover-letter `.md` → `rx.coverLetters.generate` / `update` → `parseCoverLetter`
(`## Contact`, `## Letter`, `## Closing`; errors like `closing: required`) →
`toCreateBody` / `toUpdateBody` (checked against the API's schemas) → the
cover-letter endpoints.

Gotchas:

- `sync-resume/` is not a tool: it is the `Resume.md` parser that
  `rx-resume/resume/` imports.
- The CLI tests that drive the menu, argv parsing, prompts, registry and
  `runCli` live in one file, `src/cli/tools/rx-resume/cli.test.ts`, with
  their doubles (fake prompter, harness, `withRecordedRuns`).
- `.env` (see `.env.example`): `RXRESUME_API_KEY`, `RXRESUME_API_URL`,
  `RXRESUME_APP_URL`, optional `RXRESUME_DEBUG` (logs every
  request to stderr). Bun loads it; config modules take an
  injected `env` object.
- `.gitignore` blocks every `*.md` except `README.md`, `docs/`, `AGENTS.md`,
  `CLAUDE.md` and `.claude/skills/`.
- Gitignored personal data: `resume/RxResume/Resume.json`, `*.base64.txt`,
  `*.pdf`, `*.docx`, `.env*`.

## Conventions

- Zod schemas live in each folder's `schema.ts`; infer data types with
  `z.infer` in `types.ts`. Hand-write types only for non-data (options, clients).
- Fixed value sets use enums or `as const` objects, and UI strings live in a
  `*Label` enum at the top of the file. No magic strings.
- Explicit parameter and return types; every exported function gets JSDoc with
  `@param`, `@returns`, `@example`, and `@throws` where relevant.
- Inject dependencies (`fetch`, `env`, `cwd`) rather than reading globals.
- No ternaries: use `if`/`else` (early returns) or `switch`.
- Throw a `ReasonedError` subclass with a typed reason (`CliError`,
  `RxResumeError`), never a bare `Error`; word the message in that class's
  `describe…` switch.
- Descriptive names: no `stub`, single-letter or catch-all names
  (`context`, `given`). The CLI's terms (spec, option, answers, values,
  context) are defined at the top of `src/cli/types.ts`.
- Tests: Vitest, colocated as `foo.test.ts`. No `mocks.ts` or fixture files:
  each test file declares its own doubles and synthetic data (Jane Doe, Acme
  BV, never a real resume or letter), and tests that would share them live in
  one file per surface. Write the test first. CLI tests use the registered
  tools, never tools built for the test (`withRecordedRuns` swaps only a
  tool's `run`).
- TDD: before writing any test, load the `tdd` skill
  (`.claude/skills/tdd/`), confirm the seams under test with the user, then
  work one red → green slice at a time. No logic without a failing test
  first. A hook (`.claude/hooks/tdd-gate.sh`) denies edits to `*.test.ts`
  until the skill is loaded in the session.

## Adding a tool

1. `src/cli/tools/<platform>/<tool>.ts` exporting `defineTool(...)`; `run`
   throws on failure, and imports from the platform only through
   `src/<platform>/index.ts`.
2. Append it to the platform's list in `src/cli/tools/<platform>/index.ts`.
   A new platform's list is spread into `TOOLS` in `src/cli/registry.ts`.
3. Put real logic behind `src/<platform>/index.ts` as an operation, tested
   first through that interface (for Reactive Resume: `connectRxResume` with
   `recordingFetch`, in `src/rx-resume/index.test.ts`).
4. Add a `Platform` entry only for a new destination or kind of job, never a
   vendor.

## Removing a platform

1. `rm -r src/<platform> src/cli/tools/<platform>`.
2. Drop its spread and import from `TOOLS` in `src/cli/registry.ts`.
3. Drop its `Platform` entry in `src/cli/types.ts` and its `.env.example`
   variables.
4. `bun run typecheck && bunx vitest run` pass with nothing else changed.
