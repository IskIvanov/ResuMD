# resume-tools

Keep one `Resume.md` as the source of truth for your CV, and sync it everywhere
else it has to live: a personal website, a CV builder, an application form.

Resume content drifts when it's copied by hand between places. `resume-tools`
parses a plain Markdown resume into typed, structured data, then writes that
data into each target's own format. It only touches text fields. Links, IDs,
layout and styling in the target stay as they are.

## What's included

| Tool          | What it does                                                                                                                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sync-resume` | Parses `Resume.md` and merges the text into a site CV (Markdown with YAML frontmatter). It then patches a [Reactive Resume](https://rxresu.me) JSON export, which you can re-import into Reactive Resume. |

### Planned

- A CLI that renders a CV with a custom layout straight from `Resume.md`.
- Direct integration with the
  [Reactive Resume API](https://docs.rxresu.me/api-reference), so you don't have
  to export and re-import JSON by hand.
- Adapters for more CV builders, all fed by the same typed resume model.

## Usage

Requires [Bun](https://bun.sh).

```bash
bun install
bun run sync --cv path/to/cv.md
```

| Option              | Default                                | Description                                                                         |
| ------------------- | -------------------------------------- | ----------------------------------------------------------------------------------- |
| `--cv <path>`       | required                               | Site CV to update: Markdown with YAML frontmatter. The body is the summary.         |
| `--resume <path>`   | `resume/Resume.md`                     | The source-of-truth resume.                                                         |
| `--json <path>`     | `resume/RxResume/Resume.json`          | Reactive Resume export to patch. Created from `--template` if it doesn't exist yet. |
| `--template <path>` | `resume/RxResume/Resume.template.json` | Starting point for a new Reactive Resume JSON.                                      |

Paths you pass on the command line are resolved from the current directory.
Defaults are resolved from the package root.

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

- `resume/Resume.md` is the central, hand-edited resume.
- `resume/RxResume/Resume.template.json` is a Reactive Resume v5 template with
  placeholder content. It is the only JSON file in version control.
- `resume/RxResume/Resume.json` is your real export. It is gitignored, because
  it holds personal data. To start, import the template into Reactive Resume.
  Rename the placeholder entries there so they match your companies, schools and
  skill groups, export the result, and save it at this path.

## Development

```bash
bun run test       # vitest
bun run typecheck  # tsc --noEmit
```

Tests use the synthetic fixtures in `src/sync-resume/fixtures/`, never the real
resume.
