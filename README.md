# resume-tools

Keep one `Resume.md` as the source of truth for your CV, and sync it into
[Reactive Resume](https://rxresu.me) through its API, along with cover letters
written the same way.

## What's included

| Tool                    | What it does                                                                                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generate-rx-resume`    | Parses `Resume.md` and creates a new resume in [Reactive Resume](https://rxresu.me) through its API, filled with your personal details, summary and every section of the resume.                          |
| `update-rx-resume`      | Parses `Resume.md` and rewrites an existing resume in [Reactive Resume](https://rxresu.me) through its API, by the id that `generate-rx-resume` prints. Layout, template and picture are kept.            |
| `delete-rx-resume`      | Permanently deletes a resume in [Reactive Resume](https://rxresu.me) through its API, by the id that `generate-rx-resume` prints.                                                                         |
| `generate-cover-letter` | Parses a cover-letter `.md` and creates a cover letter in [Reactive Resume](https://rxresu.me) through its API, linked to a resume for the sender's details and design.                                   |
| `update-cover-letter`   | Parses a cover-letter `.md` and rewrites an existing cover letter in [Reactive Resume](https://rxresu.me) through its API, by the id that `generate-cover-letter` prints.                                 |
| `delete-cover-letter`   | Permanently deletes a cover letter in [Reactive Resume](https://rxresu.me) through its API: moves it to Trash, then purges it.                                                                            |

Run any tool from an interactive menu (`bun run cli`) or directly with
`bun run cli <tool> [flags]`.

### Planned

- A CLI that renders a CV with a custom layout straight from `Resume.md`.
- Downloading the generated resume as a PDF from the
  [Reactive Resume API](https://docs.rxresu.me/api-reference).
- Adapters for more CV builders, all fed by the same typed resume model.

## Usage

Requires [Bun](https://bun.sh).

```bash
bun install
```

### Interactive menu

```bash
bun run cli
```

The menu lists every tool, grouped by platform. Pick one and answer its prompts.
Before running, it prints the matching direct command and asks to confirm:

```
? Which tool do you want to run?
 ── Reactive Resume ──
❯ Generate resume — create a new resume in Reactive Resume via its API
  Update resume — rewrite an existing resume in Reactive Resume from Resume.md
  Delete resume — permanently delete a resume in Reactive Resume via its API
  Generate cover letter — create a cover letter in Reactive Resume from a .md
  Update cover letter — rewrite an existing cover letter in Reactive Resume from a .md
  Delete cover letter — permanently delete a cover letter in Reactive Resume via its API
  Exit
```

- Required options come first. Optional flags are offered in a checkbox that
  shows each default.
- Paths are checked as you type. An unsupported extension (`Resume.cp`) or a
  missing file is rejected with a message.
- An option with a fixed set of values, such as `--template`, is picked from a
  list.
- A tool that can't run is listed as unavailable, with the reason. For example,
  `generate-rx-resume` is unavailable until `.env` has the Reactive Resume
  settings.
- Ctrl+C cancels. Exit codes: `0` success, `1` failure, `130` cancelled.
- The menu needs a terminal. Without one, it prints each tool's usage line.

### Cover letters

`generate-cover-letter`, `update-cover-letter` and `delete-cover-letter` manage
a Reactive Resume cover letter from one hand-edited `.md`, the way `Resume.md`
drives a resume: the `.md` holds the letter's text, and flags carry the rest.
The `.md` format, the flags and what each tool prints are in
[docs/cover-letter.md](docs/cover-letter.md).

## Resume data

- `Resume.md` is your central, hand-edited resume. It belongs to your own
  project and is passed in with `--resume`. This repo never stores one, and
  `.gitignore` blocks any `*.md` other than the README and the docs.
- Reactive Resume is written from `Resume.md` through its API
  (`generate-rx-resume`, `update-rx-resume`), so no Reactive Resume JSON is
  kept in this repo. `resume/RxResume/Resume.json`, if you keep an export
  there, stays gitignored, because it holds personal data.

### Validation

Both commands check the parsed `Resume.md` before they write anything. The run
fails if any of these is missing, and the error names each path, for example
`jobs[2].role: required`:

- the `## Summary` text
- at least one job, skill group and education item
- a job's company, `**Role** | dates` line and `**Tech Stack:**` line
- an education item's school and `**Degree** | dates` line
- a skill group's heading and items
- a certification's title and issuer

Locations, context paragraphs, bullets, links and the other sections are
optional. A job may add a `**Reference:** a@example.com, b@example.com` line
with one or two contacts at that employer. The label may be bold or plain, in
any case, singular or plural (`References:`, `**Reference**:`). Each entry must
be a distinct email, for example `jobs[0].references[1]: invalid email
format`. `generate-rx-resume` and `update-rx-resume` add them as a bold
`Reference: a@example.com, b@example.com` line at the end of the job's
description.

An education item's `**Degree, Area** | dates` line is split on its first
comma into the Reactive Resume degree and area of study. Optional lines set
the other fields, each on its own line:

```md
### Example University — City

**Bachelor's degree, Computer Science** | 2012 – 2016

**Grade:** 9.0 / 10
**Location:** Amsterdam
```

`**Location:**` overrides the location in the heading. When the degree name
itself has a comma, add an `**Area:**` line and the whole title stays the
degree. Without these lines, the area, grade and location are left empty.

A certification is a `### Title — Issuer` entry. A description paragraph, a
`**Credential ID:**` line and a link are each optional:

```md
### Example Certification — Example Issuer

Short description of what it covers.

**Credential ID:** EX-0001

[Credential](https://example.com/cert/EX-0001)
```

The description and the credential ids become the Reactive Resume
description, and the first link becomes its website. Without a link, the
website is left empty.

## Development

```bash
bun run test          # vitest
bun run typecheck     # tsc --noEmit
bun run format        # biome format --write .
bun run format:check  # biome format .
```

Each folder in `src/` keeps its Zod schemas in `schema.ts` and its types in
`types.ts`. Data shapes are inferred from the schemas with `z.infer`; declare a
type by hand only when it is not data, such as CLI options or the API client.

Tests declare their synthetic fixtures inline (Jane Doe, Acme BV), never a
real resume or letter.

### Layout

A platform such as Reactive Resume is one folder, `src/<platform>/`:

- `index.ts` declares its tools. Each declares its options once with
  `defineTool`, keyed by flag, and its `run` receives typed values: paths
  resolved, lists split, defaults applied. From that one declaration,
  `defineTool` builds the menu prompts, the usage line and the argv parser, so
  the menu and `bun run cli <tool>` can't drift apart.
- `api/` holds the API client and its config, schemas and types.
- `operations/` holds the calls each tool makes, as functions that take the
  client.

A tool reaches the outside world (network, clock, files, output) only through
the context its `run` receives, which `src/cli/index.ts` fills in. Tests pass
their own, so each tool is tested through its argv without a network or
files. `src/cli/` is the menu and argv engine; `src/resume-md/` parses
`Resume.md`. The rules are in [AGENTS.md](AGENTS.md).

### Adding a tool

1. Declare it in `src/<platform>/index.ts` with
   `defineTool({ id, title, description, options, preflight?, run })` and
   append it to the platform's tool list. `run` throws on failure. It then
   shows up in the menu and runs as `bun run cli <id>`.
2. Put its API calls in `src/<platform>/operations/`, tested first through
   the tool's argv.
3. A new platform's tool list is spread into `tools` in `src/cli/index.ts`.

### Adding a provider

A provider is a service that another one could replace, such as one translation
API for another. Keep it behind an interface owned by the domain folder, one
file per provider, and pick it with an `.env` variable. Switching providers then
changes only `.env`. See [Providers](docs/interactive-cli.md#providers).
