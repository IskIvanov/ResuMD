# resume-tools

Keep one `Resume.md` as the source of truth for your CV, and sync it everywhere
else it has to live: a personal website, a CV builder, an application form.

Resume content drifts when it's copied by hand between places. `resume-tools`
parses a plain Markdown resume into typed, structured data, then writes that
data into each target's own format. It only touches text fields. Links, IDs,
layout and styling in the target stay as they are.

## What's included

| Tool                 | What it does                                                                                                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sync-resume`        | Parses `Resume.md` and merges the text into a site CV (Markdown with YAML frontmatter). It then patches a [Reactive Resume](https://rxresu.me) JSON export, which you can re-import into Reactive Resume. |
| `generate-rx-resume` | Parses `Resume.md` and creates a new resume in [Reactive Resume](https://rxresu.me) through its API, filled with your personal details, summary and every section of the resume.                          |
| `update-rx-resume`   | Parses `Resume.md` and rewrites an existing resume in [Reactive Resume](https://rxresu.me) through its API, by the id that `generate-rx-resume` prints. Layout, template and picture are kept.            |
| `delete-rx-resume`   | Permanently deletes a resume in [Reactive Resume](https://rxresu.me) through its API, by the id that `generate-rx-resume` prints.                                                                         |

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
 ── Site ──
❯ Sync resume — update the site CV and RxResume JSON from Resume.md
 ── Reactive Resume ──
  Generate resume — create a new resume in Reactive Resume via its API
  Update resume — rewrite an existing resume in Reactive Resume from Resume.md
  Delete resume — permanently delete a resume in Reactive Resume via its API
  Exit
```

- Required options come first. Optional flags are offered in a checkbox that
  shows each default.
- Paths are checked as you type. An unsupported extension (`Resume.cp`) or a
  missing file is rejected with a message.
- A tool that can't run is listed as unavailable, with the reason. For example,
  `generate-rx-resume` is unavailable until `.env` has the Reactive Resume
  settings.
- Ctrl+C cancels. Exit codes: `0` success, `1` failure, `130` cancelled.
- The menu needs a terminal. Without one, it prints each tool's usage line.

### sync-resume

```bash
bun run cli sync-resume --cv path/to/cv.md --resume path/to/Resume.md
```

| Option              | Default                                | Description                                                                         |
| ------------------- | -------------------------------------- | ----------------------------------------------------------------------------------- |
| `--cv <path>`       | required                               | Site CV to update: Markdown with YAML frontmatter. The body is the summary.         |
| `--resume <path>`   | required                               | Your source-of-truth resume. It lives in your own project, not in this package.     |
| `--json <path>`     | `resume/RxResume/Resume.json`          | Reactive Resume export to patch. Created from `--template` if it doesn't exist yet. |
| `--template <path>` | `resume/RxResume/Resume.template.json` | Starting point for a new Reactive Resume JSON.                                      |

Paths you pass on the command line are resolved from the current directory.
Defaults are resolved from the package root.

### generate-rx-resume

Copy `.env.example` to `.env` and fill it in. The API key and URL are read only
from there, and `.gitignore` keeps `.env` out of git.

```bash
cp .env.example .env
bun run cli generate-rx-resume --resume path/to/Resume.md --name "Jane Doe"
```

| Option            | Default             | Description                                            |
| ----------------- | ------------------- | ------------------------------------------------------ |
| `--resume <path>` | required            | Your source-of-truth resume.                           |
| `--name <name>`   | required            | Name of the new resume in Reactive Resume.             |
| `--slug <slug>`   | the name, slugified | URL slug. Must not be used by another of your resumes. |
| `--tags <a,b>`    | none                | Comma-separated tags.                                  |

| `.env` variable    | Description                                                                     |
| ------------------ | ------------------------------------------------------------------------------- |
| `RXRESUME_API_KEY` | API key from your Reactive Resume account settings.                             |
| `RXRESUME_API_URL` | Base URL of the API. `.env.example` has the hosted one; change it to self-host. |
| `RXRESUME_APP_URL` | URL of the web app, used to print a link to the new resume in the builder.      |

The tool creates an empty resume, fetches it to get the server's defaults for
layout and template, then updates it with the parsed content. Bun loads `.env`
from the directory you run the command in.

### update-rx-resume

Uses the same `.env` as `generate-rx-resume`.

```bash
bun run cli update-rx-resume --id <id> --resume path/to/Resume.md
```

| Option            | Default  | Description                                                 |
| ----------------- | -------- | ----------------------------------------------------------- |
| `--id <id>`       | required | Id of the resume to update, as `generate-rx-resume` prints. |
| `--resume <path>` | required | Your source-of-truth resume.                                |

The tool fetches the resume, applies the parsed content and saves it. It
rewrites the personal details, the summary and every section `Resume.md` feeds.
Items in those sections are replaced, so edits made to them in the builder
(hidden items, skill levels, experience roles) are lost on each update. The
name, slug, tags, layout, template, picture and every other section stay as they
are.

### delete-rx-resume

Uses the same `.env` as `generate-rx-resume`.

```bash
bun run cli delete-rx-resume --id <id>
```

| Option      | Default  | Description                                                 |
| ----------- | -------- | ----------------------------------------------------------- |
| `--id <id>` | required | Id of the resume to delete, as `generate-rx-resume` prints. |

Deletion is permanent: Reactive Resume also removes the resume's screenshots and
PDFs. A locked resume is refused until you unlock it in the builder. In the
menu, the "Run it?" prompt is the only confirmation.

### How matching works

Each entry in the targets is matched to `Resume.md` by name, and only text is
replaced:

- **Experience:** `### Company — Location` → role, bullets, tech stack
- **Skills:** `**Group:** a, b, c` → the skill group with the same heading
- **Education:** `### School — Location` → context and bullets
- **Summary:** the `## Summary` section → the CV body

Entries in `Resume.md` with no match in the target are skipped with a warning.
Nothing gets added or removed.

## Resume data

- `Resume.md` is your central, hand-edited resume. It belongs to your own
  project and is passed in with `--resume`. This repo never stores one, and
  `.gitignore` blocks any `*.md` other than the README and test fixtures.
- `resume/RxResume/Resume.template.json` is a Reactive Resume v5 template with
  placeholder content. It is the only JSON file in version control.
- `resume/RxResume/Resume.json` is your real export. It is gitignored, because
  it holds personal data. To start, import the template into Reactive Resume.
  Rename the placeholder entries there so they match your companies, schools and
  skill groups, export the result, and save it at this path.

### Validation

Both commands check the parsed `Resume.md` before they write anything. The run
fails if any of these is missing, and the error names each path, for example
`jobs[2].role: required`:

- the `## Summary` text
- at least one job, skill group and education item
- a job's company, `**Role** | dates` line and `**Tech Stack:**` line
- an education item's school and `**Degree** | dates` line
- a skill group's heading and items

Locations, context paragraphs, bullets, links and the other sections are
optional.

## Development

```bash
bun run test       # vitest
bun run typecheck  # tsc --noEmit
```

Each folder in `src/` keeps its Zod schemas in `schema.ts` and its types in
`types.ts`. Data shapes are inferred from the schemas with `z.infer`; declare a
type by hand only when it is not data, such as CLI options or the API client.

Tests use the synthetic fixtures in `src/sync-resume/fixtures/`, never the real
resume.

### Layout

A tool is one file, `src/cli/tools/<tool>.ts`. It declares each option once with
`defineTool`, keyed by flag, and its `run` receives typed values: paths
resolved, lists split, defaults applied. From that one declaration, `defineTool`
builds the menu prompts, the usage line and the argv parser, so the menu and
`bun run cli <tool>` can't drift apart.

Logic worth testing on its own lives in a domain folder, `src/<tool>/`, which
never reads argv or imports from `src/cli/`. A tool that only calls an API
endpoint does its work in the tool file. The design is in
[docs/interactive-cli.md](docs/interactive-cli.md).

### Adding a tool

1. Create `src/cli/tools/<tool>.ts`, exporting
   `defineTool({ id, title, description, platform, options, preflight?, run })`.
   `run` throws on failure.
2. Append it to `TOOLS` in `src/cli/registry.ts`. It then shows up in the menu
   and runs as `bun run cli <id>`.
3. If the tool has real logic, put it in a domain folder `src/<tool>/`, tested
   first.
4. Add a `Platform` entry only for a new destination or kind of job, never for a
   vendor.

### Adding a provider

A provider is a service that another one could replace, such as one translation
API for another. Keep it behind an interface owned by the domain folder, one
file per provider, and pick it with an `.env` variable. Switching providers then
changes only `.env`. See [Providers](docs/interactive-cli.md#providers).
