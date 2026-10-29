# Writing Resume.md

`Resume.md` is your central, hand-edited resume, and every platform's resume
tools read it through the same parser, so the rules below hold for all of
them. Where a line maps to a platform's field, this page names the Reactive
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

Locations, intro paragraphs, bullets, links and the other sections are
optional.

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
