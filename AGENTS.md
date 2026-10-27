# AGENTS.md

Guidance for working in `resume-tools`. See [README.md](README.md) for user docs
and [docs/interactive-cli.md](docs/interactive-cli.md) for the CLI design.

## What this is

A Bun + TypeScript (ESM, strict) CLI that keeps one hand-edited `Resume.md` as
the source of truth and syncs it elsewhere: a site CV and Reactive Resume (via
JSON or its API). A cover-letter `.md` drives a Reactive Resume cover letter
the same way.

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
  - `tools/<tool>.ts` declares one tool with `defineTool({ id, title,
    description, platform, options, preflight?, run })`. Each option is
    declared once, keyed by flag, with a `kind` (`Path`, `Text`, `List`,
    `Choice`), `required`, optional `default(given)`, path rules or
    `choices`. A `Choice` is a select in the menu, rejected in argv unless
    it's one of `choices`, and `run` gets the union of its values. A `Text`
    option can add a Zod `schema`, checked at the prompt and in argv.
  - `define-tool.ts` derives the menu prompts, usage line and argv parser from
    that declaration, so the menu and `bun run cli <tool>` can't drift.
  - `registry.ts` — the `TOOLS` array, in menu order. Append to add a tool.
  - `menu.ts`, `run-cli.ts`, `command.ts`, `prompt-options.ts`, `schema.ts`,
    `errors.ts`, `types.ts` (`Platform`, `OptionKind`, `CliLabel` enums).
  - `preflight(env)` returns a reason string when a tool can't run (e.g.
    missing API key); the menu lists it as disabled.
  - Exit codes: `0` ok, `1` failure, `130` cancelled.
- `src/<domain>/` — testable logic. Must not read argv or import from
  `src/cli/`.

Both layers sit on `src/utils/`: generic helpers (strings, records, Markdown,
Zod) that know nothing about resumes, letters or the CLI. It imports only
Node built-ins and libraries, never `src/cli/` or a domain folder. One file
per topic (`string.ts`, `record.ts`, `markdown.ts`, `schema.ts`), tests
colocated. Helpers are migrating here gradually: when you touch a domain or
CLI file and find a generic helper in it, or one domain importing a helper
from another, move it to `src/utils/` and update its callers (no re-exports).

| Folder                | Role                                                                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sync-resume/`        | `parser.ts` (Resume.md → typed data), `schema.ts` (Zod validation), `merger.ts` (text-only merge into site CV), `render-json.ts` (patch RxResume JSON), `run.ts`                                                          |
| `rx-resume/`          | `RxResumeApiClient` class (injected `fetch`; resume and cover-letter endpoints), config (`.env`), `resume-data.ts`, `layout.ts`, `patch.ts`, `apply-data.ts`, `mocks.ts` (cover-letter fixtures)                         |
| `generate-rx-resume/` | create → fetch defaults → update flow                                                                                                                                                                                     |
| `update-rx-resume/`   | rewrite an existing resume by id (keeps layout, template, picture)                                                                                                                                                        |
| `cover-letter/`       | `parser.ts` (cover-letter `.md` → recipient + content), `body.ts` (create/update bodies), `generate.ts`, `update.ts` (GET → PUT with `expectedRevision`), `delete.ts` (trash → purge), `errors.ts`, `run.ts`                         |
| `utils/`              | `string.ts` (`slugify`, `splitList`, `kebabToCamel`), `record.ts` (`omitUndefined`, `pickNonEmptyStrings`, `fillDefaults`, `camelCaseKeys`), `markdown.ts` (`splitSections`), `schema.ts` (`ValidationMessage`, `requiredText`, `idText`, `formatIssuePath`, `parseOrThrow`), `url.ts` (`trimTrailingSlashes`, `itemPath`), `error.ts` (`ReasonedError`), `type.ts` (`ValueOf`) |

Data flow: `Resume.md` → `parseResume` (Zod-validated; errors name paths like
`jobs[2].role: required`) → either `merge` into the site CV frontmatter
(matching entries by name, text only, never adding/removing) or `toResumeData`
→ Reactive Resume API. A cover-letter `.md` → `parseCoverLetter` (`## Contact`,
`## Letter`, `## Closing`; errors like `closing: required`) → `toCreateBody` /
`toUpdateBody` (checked against the API's schemas) → the cover-letter
endpoints.

Gotchas:

- `sync-resume` has a `run.ts` (`runSync`) but is **not** registered in
  `TOOLS`, although the README lists it.
- `delete-rx-resume` has no domain folder; it calls the API in the tool file.
- `.env` (see `.env.example`): `RXRESUME_API_KEY`, `RXRESUME_API_URL`,
  `RXRESUME_APP_URL`. Bun loads it; config modules take an injected `env`
  object.
- `.gitignore` blocks every `*.md` except `README.md`, fixtures, `docs/`,
  `CLAUDE.md` and `.claude/skills/`.
- Gitignored personal data: `resume/RxResume/Resume.json`, `*.base64.txt`,
  `*.pdf`, `*.docx`, `.env*`. Only `Resume.template.json` is versioned.

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
  `CoverLetterError`), never a bare `Error`; word the message in that class's
  `describe…` switch.
- Descriptive names: no `stub`, single-letter or catch-all names
  (`context`, `given`). The CLI's terms (spec, option, answers, values,
  context) are defined at the top of `src/cli/types.ts`.
- Tests: Vitest, colocated as `foo.test.ts`, shared test doubles in
  `mocks.ts`. Write the test first. CLI tests use the registered tools, never
  tools built for the test (`withRecordedRuns` swaps only a tool's `run`).
  Use the synthetic fixtures in `src/sync-resume/fixtures/` and
  `src/cover-letter/fixtures/`, never a real resume or letter.
- TDD: before writing any test, load the `tdd` skill
  (`.claude/skills/tdd/`), confirm the seams under test with the user, then
  work one red → green slice at a time. No logic without a failing test
  first. A hook (`.claude/hooks/tdd-gate.sh`) denies edits to `*.test.ts`
  until the skill is loaded in the session.

## Adding a tool

1. `src/cli/tools/<tool>.ts` exporting `defineTool(...)`; `run` throws on failure.
2. Append to `TOOLS` in `src/cli/registry.ts`.
3. Put real logic in `src/<tool>/`, tested first.
4. Add a `Platform` entry only for a new destination or kind of job, never a
   vendor.
