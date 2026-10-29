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

Two layers, on shared utilities:

- `src/cli/`: the CLI engine. It knows nothing about resumes or letters.
  - `define-tool.ts`: `defineTool({ id, title, description, options,
    preflight?, run })` turns one declaration into the menu prompts, the
    usage line and the argv parser, so the menu and `bun run cli <tool>`
    can't drift. Each option is declared once, keyed by flag, with a `kind`
    (`Path`, `Text`, `List`, `Choice`), `required`, optional
    `default(answers)`, path rules or `choices`. A `Choice` is a select in the
    menu, rejected in argv unless it's one of `choices`, and `run` gets the
    union of its values. A `Text` option can add a Zod `schema`, checked at
    the prompt and in argv.
  - `prompt.ts` (answers → argv, checking paths and schemas as typed),
    `run-cli.ts` (`runCli`: a tool by id, or the menu; `PromptCancelled`),
    `types.ts` (`OptionKind`, `RunContext`, `CliDeps`, …).
  - `index.ts` is the entry point and the registry: the only file that
    touches the real terminal, network, clock and file system, and the one
    place each platform's tool list is spread in.
  - A tool's `run(values, context)` gets a `RunContext`: `cwd`, `env`,
    `fetch`, `newId`, `today`, `now`, `readFile`, `log`, `logError`.
  - `preflight(env)` returns a reason string when a tool can't run (e.g.
    missing API key); the menu lists it as disabled.
  - Exit codes: `0` ok, `1` failure, `130` cancelled.
- `src/<platform>/`: a destination such as Reactive Resume, together with its
  tools; see Platform and Operation in `docs/GLOSSARY.md`. It imports the CLI
  only for `defineTool` and its types.
  - `index.ts` declares the platform's tools and exports their list
    (`RX_RESUME_TOOLS`); `types.ts` and `schema.ts` hold what the tools and
    operations share.
  - `api/`: the client, `.env` config, and the API's schemas and types.
  - `operations/<thing>/`: create, update and delete, as functions that take
    the client. They never read argv, files or `process`.
- `src/resume-md/`: the `Resume.md` parser, shared by any platform.

Both layers sit on `src/utils/`: generic helpers (strings, records, Markdown,
Zod) that know nothing about resumes, letters or the CLI. It imports only
Node built-ins and libraries, never `src/cli/` or a domain folder. One file
per topic (`string.ts`, `record.ts`, `markdown.ts`, `schema.ts`), tests
colocated. A helper belongs here once two folders use it; a helper with one
caller stays in that caller's file.

| Folder       | Role |
| ------------ | ---- |
| `resume-md/` | `parser.ts` (only `parseResume`: reads Resume.md once into typed logical lines, see `docs/GLOSSARY.md`), `schema.ts` (Zod validation), `types.ts` |
| `rx-resume/` | The Reactive Resume platform. `index.ts` (the six tools, `RX_RESUME_TOOLS`), `types.ts` (letter metadata), `schema.ts` (`CoverLetterIdSchema`, the letter `.md` schemas). `api/`: `client.ts` (`RxResumeApiClient` with builder and dashboard links, `RxResumeApiError`), `config.ts` (`apiConfigProblem`, `connectRxResume(env, fetch, requestLog)`), `schema.ts` (API shapes), `types.ts`. `operations/resume/`: `index.ts` (`generateResume`, `updateResume`, `deleteResume`), `mapping.ts` (ParsedResume → API `data`), `layout.ts`. `operations/cover-letter/`: `index.ts` (generate, update, delete), `parser.ts`. `index.test.ts`: every tool through its argv, with `recordingFetch` and in-memory files |
| `utils/`     | `string.ts` (`slugify`, `splitList`), `record.ts` (`omitUndefined`, `pickNonEmptyStrings`, `fillDefaults`), `markdown.ts` (`splitSections`), `schema.ts` (`ValidationMessage`, `requiredText`, `firstIssue`, `parseOrThrow`), `error.ts` (`describeCaught`), `types.ts` (`ValueOf`, `DefaultEntry`, `Env`, `FetchFn`) |

Data flow: `Resume.md` → `generate-rx-resume` / `update-rx-resume` →
`generateResume` / `updateResume` → `parseResume` (Zod-validated; errors name
paths like `jobs[2].role: required`) → `applyResume` → Reactive Resume API. A
cover-letter `.md` → `generate-cover-letter` / `update-cover-letter` →
`parseCoverLetter` (`## Contact`, `## Letter`, `## Closing`; errors like
`closing: required`) → the request body, checked against the API's schema →
the cover-letter endpoints.

Gotchas:

- `resume-md/` is not a tool: it is the `Resume.md` parser that
  `rx-resume/operations/resume/` imports.
- The CLI tests that drive the menu, argv parsing, prompts and `runCli` live
  in one file, `src/cli/cli.test.ts`, with their doubles (fake prompter,
  harness, `withRecordedRuns`). They use the Reactive Resume tools, so
  removing that platform means pointing them at another one.
- `.env` (see `.env.example`): `RXRESUME_API_KEY`, `RXRESUME_API_URL`,
  `RXRESUME_APP_URL`, optional `RXRESUME_DEBUG` (logs every
  request to stderr). Bun loads it; `cli/index.ts` passes `process.env` on
  as the run context's `env`.
- `.gitignore` blocks every `*.md` except `README.md`, `docs/`, `AGENTS.md`,
  `CLAUDE.md` and `.claude/skills/`.
- Gitignored personal data: `resume/RxResume/Resume.json`, `*.base64.txt`,
  `*.pdf`, `*.docx`, `.env*`.

## Conventions

- Zod schemas live in each folder's `schema.ts`; infer data types with
  `z.infer` in `types.ts`. Hand-write types only for non-data (options, clients).
- Fixed value sets (option kinds, env variable names, API values) use enums or
  `as const` objects. UI strings are written inline where they're used; give
  one a constant only when two places must agree.
- Explicit parameter and return types; every exported function gets JSDoc with
  `@param`, `@returns`, `@example`, and `@throws` where relevant.
- Inject dependencies (`fetch`, `env`, `cwd`, the clock, file reads) through
  `RunContext` rather than reading globals.
- No ternaries: use `if`/`else` (early returns) or `switch`.
- Throw `Error` with a message that says what went wrong and what to do, and
  pass the underlying error as `cause`. The only error classes are
  `PromptCancelled` (Ctrl+C) and `RxResumeApiError` (the API's `status` and
  `code`), since callers tell those apart.
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

1. Declare it with `defineTool(...)` in `src/<platform>/index.ts` and append
   it to the platform's tool list. `run` throws on failure, reads files with
   `context.readFile` and prints with `context.log`.
2. Put its API calls in `src/<platform>/operations/<thing>/index.ts`, as
   functions that take the client.
3. Test it first through its argv (for Reactive Resume: `runTool` with
   `recordingFetch`, in `src/rx-resume/index.test.ts`).
4. A new platform's tool list is spread into `tools` in `src/cli/index.ts`.

## Removing a platform

1. `rm -r src/<platform>`.
2. Drop its import and spread in `src/cli/index.ts`, and its `.env.example`
   variables.
3. If it was the platform `src/cli/cli.test.ts` drives, point those tests at
   another platform's tools.
4. `bun run typecheck && bunx vitest run` pass with nothing else changed.
