# resume-tools

Keep your resume and cover letters as Markdown files under version control, and
sync them to resume platforms through their APIs. One `Resume.md` connects to every
platform: [Reactive Resume](https://rxresu.me) is the first, and more, such as
[JSON Resume](https://jsonresume.org), are planned.

## Who it's for

- Anyone who wants to keep a versioned CV or cover letter in Markdown: one
  plain-text source, a git diff for every change, and a designed resume on
  whichever platform you use when you need to send one.
- [Obsidian](https://obsidian.md) users who already write in Markdown and want
  their CV and cover letters in the same vault.

## Platforms

Each platform brings its own tools. The menu asks for a platform first, then
lists its tools; the tools that need no platform sit beside the platforms.

### Reactive Resume

| Tool                  | What it does                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `connect-rx-resume`   | Tests your API key and saves it with your instance's address (`--address`, default `https://rxresu.me`). The other tools are unavailable until you connect. |
| `create-resume`       | Creates a resume from `Resume.md` and prints its id.                                         |
| `update-resume`       | Rewrites a resume from `Resume.md`, by id. Layout, template, picture and hidden items are kept; `--dry-run yes` shows the changes without saving. |
| `download-resume`     | Saves a resume as PDF, DOCX, ODT, JSON or Markdown.                                          |
| `delete-resume`       | Deletes a resume for good: moves it to Trash, then purges it.                                |
| `create-cover-letter` | Creates a cover letter from a `.md`, linked to a resume for the sender details and design.   |
| `update-cover-letter` | Rewrites a cover letter from its `.md`, by id.                                               |
| `delete-cover-letter` | Deletes a cover letter for good: moves it to Trash, then purges it.                          |

### Without a platform

| Tool             | What it does                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `example-resume` | Writes an example `Resume.md` to fill in (`--output` for another path). Never overwrites a file. |

## Quick start

Requires [Bun](https://bun.sh) and, for Reactive Resume, an API key from your
account's settings.

```bash
bun install
bun run cli example-resume   # 1. writes Resume.md; fill in your details
bun run cli                  # 2. pick Reactive Resume, then Connect
bun run cli                  # 3. pick Reactive Resume, then a tool
bun run cli <tool> [flags]   # or run one tool directly
```

Connect tests your key, then saves it with your instance's address in
`~/.config/resume-tools/.env`, readable only by you, so every later run uses it
from any folder. Connect from the menu, where the key is typed hidden:
`connect-rx-resume --api-key …` leaves the key in your shell history. To change
the key, connect again; to disconnect, delete that file. A shell variable or a
`.env` in the current folder (see `.env.example`) overrides a saved setting.

The menu asks for each option and prints the matching direct command before
it runs. Without a terminal, `bun run cli` prints every tool's usage line.

## Documentation

- [Writing Resume.md](docs/resume-md.md): where it lives, what's required, the
  optional lines, Reactive Resume's export and what an update keeps.
- [Cover letters](docs/cover-letter.md): the cover-letter `.md`, the flags and
  what each tool prints.
- [Interactive CLI](docs/interactive-cli.md): how the menu, prompts, tool
  arguments and exit codes behave.
- [Glossary](docs/GLOSSARY.md): the terms used across the code and docs.
- [AGENTS.md](AGENTS.md): architecture, conventions, and adding a tool or a
  platform.

## Planned

- More platforms, starting with [JSON Resume](https://jsonresume.org), all fed
  by the same `Resume.md` parser.
- A CLI that renders a CV with a custom layout straight from `Resume.md`.

## Development

```bash
bun run test          # vitest
bun run typecheck     # tsc --noEmit
bun run format        # biome format --write .
bun run format:check  # biome format .
```
