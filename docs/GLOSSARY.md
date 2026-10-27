# Glossary

Domain terms used across resume-tools. Code, tests and reviews use these names.

## Resume.md

**Resume.md**
: The hand-edited Markdown resume that is the source of truth. Never committed
here; tests use `src/sync-resume/fixtures/Resume.md`.

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
paragraph. `classifyLine` in `sync-resume/parser.ts` is the only place that
decides it.

**Job reference**
: A contact listed under a job on a `Reference: a, b` line (plain or bold,
singular or plural). Becomes `ParsedJob.references`.

**References note**
: A standalone paragraph such as "References available upon request", read
when there is no `## References` section. Never a job reference.
