# Glossary

Domain terms used across resume-tools. Code, tests and reviews use these names.

## Resume.md

**Resume.md**
: The hand-edited Markdown resume that is the source of truth. Never committed
here; tests use the synthetic `RESUME_MD` in `src/rx-resume/index.test.ts`.

**Header**
: The lines above the first `## ` heading: `# Name`, a `**Headline**` and the
`a | b | c` contact line, plus profile links.

**Section**
: A `## Heading` and its body, e.g. `## Experience`.

**Entry**
: A `### Heading` block inside a section: one job, school or project.

**Logical line**
: One line of meaning after hard-wrapped lines are joined. A blank line, a
bullet, heading, rule or reference line opens a new one; any other line
continues the previous one.

**Line kind**
: What a logical line is: rule, bullet, reference, tech stack, title
(`**Role** | dates`), labelled (`**Label** rest`), markup, URL, links or
paragraph. `classifyLine` in `resume-md/parser.ts` is the only place that
decides it.

**Job reference**
: A contact listed under a job on a `Reference: a, b` line (plain or bold,
singular or plural). Becomes `ParsedJob.references`.

**References note**
: A standalone paragraph such as "References available upon request", read
when there is no `## References` section. Never a job reference.

## Platforms

**Platform**
: A destination the tools write to, e.g. Reactive Resume. One folder,
`src/rx-resume/`: its tools in `index.ts`, its API client in `api/`, its
operations in `operations/`. Its tool list is spread into the CLI's tools in
`src/cli/index.ts`; deleting the folder and that line removes it.

**Tool**
: One command a platform offers, e.g. `update-rx-resume`, declared with
`defineTool`. It runs from the menu or as `bun run cli <id> [flags]`, reads
its file, calls an operation and prints the result.

**Operation**
: One thing a platform does through its API, e.g.
`updateResume(client, id, markdown, newId)`. Takes the client and Markdown
text and returns what the API saved; it never reads files or argv.
