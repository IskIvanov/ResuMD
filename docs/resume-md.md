# Writing Resume.md

`Resume.md` is your central resume, written by hand or downloaded from Reactive
Resume, and every platform's resume tools read it through the same parser, so
the rules below hold for all of them. Where a line maps to a platform's field, this page names the Reactive
Resume one, the only platform so far. The terms used here (header, section,
entry, job, school, skill group) are defined in
[GLOSSARY.md](GLOSSARY.md#resumemd).

## Where it lives

- `Resume.md` belongs to your own project, such as an Obsidian vault or a git
  repo, and is passed in with `--resume`. This repo never stores one, and
  `.gitignore` blocks any `*.md` other than the README and the docs.
- Platforms are written from `Resume.md` through their APIs, so no platform's
  export is kept in this repo. `resume/RxResume/Resume.json`, if you keep
  an export there, stays gitignored, because it holds personal data.

## Validation

The parser checks `Resume.md` before any tool writes anything. The run
fails if any of these is missing, and the error names each path, for example
`jobs[2].role: required`:

- the `## Summary` text
- at least one job, skill group and school
- a job's company, `**Role** | dates` line and `**Tech Stack:**` line
- a school's name and `**Degree** | dates` line
- a skill group's label and skills
- a certification's title and issuer

A line starting with `• ` also fails the run, naming the first one: bullets are
always `- text`, and a `• ` line would otherwise pass as plain text and lose
the bullet.

Locations, intro paragraphs, bullets, links and the other sections are
optional.

## Reactive Resume's Markdown export

`download-resume --format md` writes a file the parser reads as it is, so you
can download, edit and update. Both shapes work, entry by entry, and an entry
with a `**Title** | dates` line is read the hand-written way:

| Part       | Hand-written                                     | Exported                                  |
| ---------- | ------------------------------------------------ | ----------------------------------------- |
| Headline   | `**Headline**`                                   | `_Headline_`                              |
| Contact    | `a \| b \| c`                                    | `a · b · [site](https://…)`               |
| Job        | `### Company — City` + `**Role** \| dates`        | `### Company — Role (dates)` + `_City_`   |
| School     | `### School — City` + `**Degree, Area** \| dates` | `### School — Degree, Area (dates)` + `_City · Grade: x_` |
| Skills     | `## Technical Skills`, `**Label:** a, b`         | `## Skills`, `- **Label**: a, b`          |
| Languages  | `- English — Native`                             | `- **English** — Native`                  |
| Interests  | `A · B · C`                                      | `- **A**: keywords`                       |

The dates of a heading are always its last parentheses, so
`### Acme — Engineer (Contract) (2021 – 2022)` has the role
`Engineer (Contract)`. A project's `### Title (period)` and a certification's
`### Title — Issuer (date)` set those fields, so a title ending in parentheses
is read as having a period.

`**bold**`, `_italic_`, `~~strikethrough~~`, `<u>underline</u>` and links in
the summary, intros, bullets and tech stacks are written as rich text.

## What update-resume keeps

The export is only part of a resume, so `update-resume` keeps what it can't
show:

- hidden items, and a hidden section the file has nothing for
- for an item matching a stored one, its id and the fields the export leaves
  out: skill and language levels, icons, a website's details and a reference's
  position, phone, website and description. Items match by name (job: company
  and role; school: school and degree), so a renamed item loses them.

It refuses to save when a visible section with items has nothing in the file,
since that would delete them. This is what a renamed section looks like too,
because only the headings above are read. Fix the heading, or clear the section
in Reactive Resume first.

`--dry-run yes` prints each section's item count before and after, and any
section a real run would refuse, without saving anything.

## Job references

A job may add a `**Reference:** a@example.com, b@example.com` line with one or
two references at that employer. The label may be bold or plain, in any case,
singular or plural (`References:`, `**Reference**:`). Each entry must be a
distinct email, for example `jobs[0].references[1]: invalid email format`.
In Reactive Resume, `create-resume` and `update-resume` add them as a bold
`Reference: a@example.com, b@example.com` line at the end of the job's
description.

## Schools

A school's `**Degree, Area** | dates` line is split on its first comma into
the Reactive Resume degree and area of study. Optional lines set the other
fields, each on its own line:

```md
### Example University — City

**Bachelor's degree, Computer Science** | 2012 – 2016

**Grade:** 9.0 / 10
**Location:** Amsterdam
```

`**Location:**` overrides the location in the heading. When the degree name
itself has a comma, add an `**Area:**` line and the whole title stays the
degree. Without these lines, the area, grade and location are left empty.

## Certifications

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
