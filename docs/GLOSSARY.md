# Resume tools

The language of resume-tools: the Markdown files a person writes, the Reactive
Resume documents the tools write from them, and the tools themselves. Code,
tests and reviews use these names. Reactive Resume's own words are taken from
its documentation at docs.rxresu.me.

## Resume.md

**Resume.md**:
The Markdown resume every resume the tools write comes from, written by hand or
downloaded as a Markdown export.
_Avoid_: CV, source file

**Markdown export**:
The `.md` Reactive Resume writes for a resume. It holds only what's visible, so
an update keeps what it leaves out.

**Header**:
The lines above the first section: `# Name`, a `**Headline**` or `_Headline_`,
the `a | b | c` or `a · b · c` contact line and profile links.
_Avoid_: contact, basics

**Section**:
A `## Heading` and the text under it, e.g. `## Experience`.

**Entry**:
A `### Heading` block inside a section: one job, school or project.
_Avoid_: item

**Job**:
An entry under `## Experience`: one role at one company.
_Avoid_: experience item, position

**School**:
An entry under `## Education`: one degree or course at one school.
_Avoid_: edu item, education item

**Skill group**:
A `**Label:** a, b, c` line under `## Technical Skills`, or a
`- **Label**: a, b, c` bullet under `## Skills`: a label and the skills listed
after it.

**Intro**:
The paragraph right under an entry's title line, e.g. a sentence about the
company, the team or the project.
_Avoid_: context

**Logical line**:
One line of meaning after hard-wrapped lines are joined. A blank line, bullet,
heading, rule or reference line opens a new one; any other line continues the
previous one.

**Line kind**:
What a logical line is: rule, bullet, reference, tech stack, title
(`**Role** | dates`), labelled (`**Label** value`), markup, URL, links, italic
or paragraph.

**Job reference**:
A person listed under a job on a `Reference: a, b` line, plain or bold,
singular or plural.
_Avoid_: references note

**References note**:
A standalone paragraph such as "References available upon request", read when
there is no `## References` section.
_Avoid_: job reference

## Cover-letter .md

**Cover-letter .md**:
The hand-edited Markdown file that one cover letter is written from.

**Recipient block**:
The lines naming who the letter is addressed to, such as a person or team and
their company, written under `## Recipient`.
_Avoid_: contact, hiring manager's block

**Body**:
The letter's text, from the greeting to its last paragraph, written under
`## Letter`, as Reactive Resume's editor labels it.
_Avoid_: content

**Sign-off**:
The closing words and the signature under them, written under `## Sign-off`.
_Avoid_: closing

## Reactive Resume

**Reactive Resume**:
The resume builder the tools write to, hosted at rxresu.me or self-hosted.

**Document**:
A resume or a cover letter in Reactive Resume. Both kinds are locked, moved to
Trash and purged the same way.

**Resume**:
A document in Reactive Resume that a tool creates or updates from Resume.md.
_Avoid_: CV

**Cover letter**:
A document in Reactive Resume written from a cover-letter `.md`. "Letter" is
fine as a short form.

**Source resume**:
The resume a cover letter takes its sender details from and, while it matches,
its design.
_Avoid_: linked resume, parent resume

**Match**:
A cover letter matches its source resume while it takes that resume's template,
type and colors live. Giving the letter its own template stops it matching.
_Avoid_: follow, design link

**Job application**:
A job the person is applying for, tracked in Reactive Resume. A cover letter
can be linked to one.
_Avoid_: job (a job is a role in Resume.md)

**Freeform letter**:
A cover letter that prints its recipient block and body exactly as written. The
tools write only freeform letters, never structured ones, which Reactive Resume
builds from separate recipient, greeting and sign-off fields.
_Avoid_: plain letter

**Revision**:
The number Reactive Resume raises each time a cover letter is saved. An update
names the revision it last read and is rejected if the letter has changed
since.
_Avoid_: version

**Version**:
A snapshot in a document's History that can be restored. The tools never make
one.
_Avoid_: revision

**Locked**:
Said of a document that can't be edited or moved to Trash until it's unlocked.

**Trash**:
Where a document waits for 30 days after it's moved there, and can be
restored, before it's purged.
_Avoid_: bin

**Purge**:
To delete a document in Trash for good, so it can't be restored. Reactive
Resume's app calls this "Delete now".
_Avoid_: remove, permanently delete

**Editor**:
Reactive Resume's page for editing one document. The tools link to it after
every write.
_Avoid_: builder, dashboard

## Tools

**Platform**:
A destination the tools write to, e.g. Reactive Resume.
_Avoid_: vendor, integration

**Tool**:
One thing a person can run against a platform, or on Resume.md alone, from the
menu or directly with flags.
_Avoid_: script

**Connect**:
To give the tools a platform's address and API key: the key is tested, then
saved, so later runs from any folder can use the platform's other tools.
_Avoid_: login, credentials

**Operation**:
One thing a platform does through its API, such as creating a resume. It takes
Markdown text and returns what the API saved.

**Create**:
To make a new document from a `.md`.
_Avoid_: generate, new

**Update**:
To rewrite an existing document from its `.md`, keeping whatever the `.md`
doesn't hold, such as the layout, template and hidden items.
_Avoid_: sync, regenerate

**Delete**:
To move a document to Trash and then purge it, so nothing is left behind.
Reactive Resume's API also says "delete" for moving to Trash alone; here it
always ends with a purge.
_Avoid_: remove, trash (for moving to Trash alone)

## Between the Markdown and Reactive Resume

- **Section, Entry**: mean the same in both. Reactive Resume's data calls
  entries items.
- **Header → Basics**: the name, headline and contact line; profile links
  become custom fields.
- **Job → Experience entry**: the role becomes the position; the intro,
  bullets, tech stack and job references become its description.
- **School → Education entry**.
- **Skill group → Skills entry**: the label becomes its name, the skills its
  keywords.
- **Recipient block → recipient**, **body and sign-off → content**, for a
  freeform letter.
