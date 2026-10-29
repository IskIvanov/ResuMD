# Spec: Cover letters in Reactive Resume

Linear:
[BAC-60](https://linear.app/ivanovdev/issue/BAC-60/create-and-update-cover-letter)
· Status: **implemented**. See [Implementation notes](#implementation-notes)
for where the code differs from or adds to the plan. Risk 3 below is
resolved; the others are still open.

> **Revision (merged platforms):** the cover-letter code now lives in
> `src/rx-resume/operations/cover-letter/` (`index.ts`: create, update and
> delete, taking the API client; `parser.ts`), and the three tools are
> declared in `src/rx-resume/index.ts`, which also prints. `body.ts`,
> `update.ts`, `delete.ts`, `CoverLetterError` and `camelCaseKeys` are gone:
> failures are plain `Error` messages, and the tools map flags to API field
> names directly. `letterDate` comes from the run context's `today`; luxon is
> gone. The tests drive each tool through its argv with `recordingFetch`.
> Paths below describe the original layout.
>
> **Revision (glossary names):** the tools are `create-cover-letter`,
> `update-cover-letter` and `delete-cover-letter`; the `.md`'s sections are
> `## Recipient`, `## Letter` and `## Sign-off`, and errors name them as
> `recipient`, `letter` and `signOff`; links print as `editor:`. The terms are
> in [GLOSSARY.md](GLOSSARY.md). Sections from "Changes by file" on keep the
> names of the time.

## Goal

Manage a Reactive Resume cover letter from one hand-edited Markdown file, the
same way `Resume.md` drives a resume. Three new tools are added under the
**Reactive Resume** menu group:

| Tool id                 | Title                 | Does                                        |
| ----------------------- | --------------------- | ------------------------------------------- |
| `create-cover-letter`   | Create cover letter   | Creates a letter from the `.md`             |
| `update-cover-letter`   | Update cover letter   | Rewrites an existing letter from the `.md`  |
| `delete-cover-letter`   | Delete cover letter   | Deletes a letter for good                   |

## Non-goals

- A link to the letter's editor. For now the tools print the letter's
  dashboard link, `<appUrl>/dashboard/<id>`, and the editor link will come in
  a later ticket.
- The API's other cover-letter endpoints (versions, export, import, AI draft,
  duplicate, style refresh).
- Writing the sender's details into the letter. They come from the linked
  resume (see [Sender details](#sender-details)).
- Restoring a letter from Trash. Delete is permanent.

## Decisions

| #  | Decision |
| -- | -------- |
| 1  | The `.md` is the source of truth for the letter's text. CLI flags carry the metadata (`name`, ids, company, template). |
| 2  | The `.md` has three **required** sections: `## Recipient` (the recipient block), `## Letter` (the body) and `## Sign-off`. |
| 3  | The sender's own details come live from the source resume, so `--resume-id` is **required** on create. |
| 4  | `layout` is always `freeform`: the `.md` writes its own greeting and sign-off, so `structured` would duplicate them. |
| 5  | The `.md` always sets `recipient`, even when `--application-id` is given. The application only links the job. |
| 6  | `letterDate` is set to today on **every** create and update, formatted with luxon. |
| 7  | Update refuses to overwrite a concurrent edit: `GET` → `PUT` with `expectedRevision`, with no retry. |
| 8  | Delete is **permanent**: move the letter to Trash, then purge it. |
| 9  | Flags use kebab case (`--resume-id`, `--application-id`). `--company` and `--template` are optional. |
| 10 | `--template` is chosen from a fixed list of 17 names. When it's left out, the letter takes the resume's design. |
| 11 | Code **extends** existing modules, with no relocation or duplication. The only new folder content is the existing `src/cover-letter/` placeholder. |

## The API, as the plan relies on it

Checked against `https://rxresu.me/api/openapi/spec.json`.

| Step         | Request                                                     | Notes |
| ------------ | ----------------------------------------------------------- | ----- |
| create       | `POST /cover-letters`                                       | Returns the full letter object; `POST /resumes` returns only an id |
| read         | `GET /cover-letters/{id}`                                   | Used to get `revision` |
| update       | `PUT /cover-letters/{id}` with `expectedRevision`           | Every field optional except `expectedRevision`. **No `layout` field** |
| trash        | `DELETE /cover-letters/{id}` with body `{ expectedRevision }` | Rejected for a locked letter |
| purge        | `DELETE /documents/letter/{id}`                             | Only works on a letter already in Trash |

Body fields used, with the API's limits (mirrored in Zod):

| Field              | Create | Update | Limit |
| ------------------ | ------ | ------ | ----- |
| `name`             | required | optional | 1–100 chars |
| `recipient`        | ✓ (from `.md`) | ✓ (from `.md`) | ≤ 20 000 chars |
| `content`          | ✓ (from `.md`) | ✓ (from `.md`) | ≤ 100 000 chars, **plain text** |
| `resumeId`         | ✓ (required by us) | optional | min 1; links sender and design |
| `applicationId`    | optional | optional | min 1 |
| `recipientCompany` | optional | optional | ≤ 200 chars |
| `template`         | optional | optional | one of 17 names; unlinks the design |
| `layout`           | `"freeform"` | — | not in the update body |
| `letterDate`       | today | today | `YYYY-MM-DD` |
| `expectedRevision` | — | ✓ | integer ≥ 1 |

### Sender details

Neither the create nor the update body accepts sender details. The letter's
`style.basics` is a copy of the sender's details, or is read live from the
resume when `senderLinked` is true. Passing `resumeId` on create links both
the sender and the design, and `Resume.md` already feeds that resume through
create-resume and update-resume. That's why `--resume-id` is required: a letter
without it has no sender block, and nothing can fill one.

## The cover-letter `.md`

```md
## Recipient

Jane Smith
Acme BV
Amsterdam, Netherlands

## Letter

Dear Jane,

First paragraph…

Second paragraph…

## Sign-off

Kind regards,
Jane Doe
```

| Section        | Becomes     | Rule |
| -------------- | ----------- | ---- |
| `## Recipient` | `recipient` | Lines kept as written, trimmed |
| `## Letter`    | `content`   | Then a blank line, then `## Sign-off`. Paragraphs and hard line breaks kept |
| `## Sign-off`  | `content`   | |

- Sections are split by the existing `splitSections` in
  `sync-resume/parser.ts`. It is only **exported**, not moved.
- `---` rules between sections are dropped, as in `Resume.md`. Other sections
  are ignored.
- The text is sent as it is. `content` is plain text, so there's no
  Markdown-to-HTML conversion, and `**bold**` arrives literally.
- A missing or empty section fails Zod validation with a path that names it,
  e.g. `signOff: required`, in the same style as `jobs[2].role: required`.

## CLI

```
bun run cli create-cover-letter --letter <path.md> --name <text> --resume-id <id>
    [--application-id <id>] [--company <text>] [--template <template>]

bun run cli update-cover-letter --id <letterId> --letter <path.md>
    [--name <text>] [--company <text>] [--resume-id <id>]
    [--application-id <id>] [--template <template>]

bun run cli delete-cover-letter --id <letterId>
```

- `--letter` is an `OptionKind.Path` that accepts `.md` and must exist.
- `--company` is sent as `recipientCompany`.
- On update, an optional flag that isn't given leaves the stored value as it is.
- All three tools use `preflight: describeMissingSettings`, so they're
  disabled in the menu until `.env` has the Reactive Resume settings.
- They follow the resume tools in the menu, in the order create, update,
  delete.

In use:

- `--resume-id` links the letter to its source resume, which gives it the
  sender details and design. Keep that resume up to date from `Resume.md`
  with `update-resume`.
- `--template` picks one of the 17 templates, and the letter stops matching
  the resume's design. Leave it out to keep matching it.
- Update is refused if the letter was edited after it was read; run it again.
  It's also refused, before anything is sent, for a letter that isn't
  `freeform` (see risk 3 below).
- Delete is permanent: the letter is moved to Trash, then purged. If the purge
  fails, the error says the letter is in Trash, where it can still be
  restored.

### Output

```
✓ Created cover letter "Acme — Frontend" (id clx…, revision 1, template onyx)
  editor: https://rxresu.me/dashboard/clx…
✓ Updated cover letter "Acme — Frontend" (id clx…, revision 4)
  editor: https://rxresu.me/dashboard/clx…
✓ Deleted cover letter clx…
```

`, template <name>` is printed only when `--template` was given, so it's
visible that the letter no longer matches the resume's design. The origin
comes from `RXRESUME_APP_URL` (already in `.env.example`), so a local instance
works without code changes. Only the `/dashboard/<id>` path is in code.

## Changes by file

### `src/rx-resume/`: extend the API layer

**`schema.ts`**
- `CoverLetterTemplate` is an `as const` object with the 17 names (`azurill` …
  `smeargle`). It's the single list used by both Zod and the CLI.
- `CoverLetterLayout` is `{ Structured: "structured", Freeform: "freeform" }`.
- `CreateCoverLetterBodySchema` and `UpdateCoverLetterBodySchema` follow the
  limits in the table above. `letterDate` uses `z.iso.date()`.
- `CoverLetterSchema` is the response. It declares only the fields we read
  (`id`, `name`, `revision`, `recipient`, `content`, `layout`,
  `recipientCompany`, `letterDate`, `senderLinked`, `designLinked`,
  `isLocked`), with `style: z.looseObject({ basics: BasicsSchema })`, so the
  existing `BasicsSchema` is reused rather than copied. Other fields are passed
  through untouched, as `ResumeSchema` does.

**`types.ts`**
- Adds `z.infer` types for `CreateCoverLetterBody`, `UpdateCoverLetterBody`,
  `CoverLetter` and `CoverLetterTemplate`.
- Adds five methods to `RxResumeClient` (below).

**`client.ts`**: new methods on the `RxResumeApiClient` class, reusing the private
`request`, `HttpMethod` and `RxResumeApiError`:

| Method | Request |
| ------ | ------- |
| `createCoverLetter(body): Promise<CoverLetter>` | `POST /cover-letters` |
| `getCoverLetter(id): Promise<CoverLetter>` | `GET /cover-letters/{id}` |
| `updateCoverLetter(id, body): Promise<CoverLetter>` | `PUT /cover-letters/{id}` |
| `trashCoverLetter(id, expectedRevision): Promise<void>` | `DELETE /cover-letters/{id}` with body |
| `purgeCoverLetter(id): Promise<void>` | `DELETE /documents/letter/{id}` |

Paths are module constants, following `RESUMES_PATH`. `request` already
sends a JSON body on any method, which the trash call needs.

**`config.ts`**
- Adds `resolveLetterDashboardUrl(appUrl, coverId)`, which returns
  `<appUrl>/dashboard/<id>` and sits next to `resolveBuilderUrl`.

### `src/sync-resume/parser.ts`

- `export function splitSections`. Nothing else changes.

### `src/cover-letter/`: fills the empty placeholder

| File | Holds |
| ---- | ----- |
| `schema.ts` | `ParsedCoverLetterSchema` (`recipient`, `content`, both required and length-capped) |
| `types.ts` | `ParsedCoverLetter` (inferred); option types for the three runs; the `Pick<RxResumeClient, …>` each flow needs |
| `parser.ts` | `parseCoverLetter(md): ParsedCoverLetter`; `CoverLetterHeading` = `Contact`, `Letter`, `Closing` |
| `body.ts` | `toCreateBody(parsed, options, today)` and `toUpdateBody(parsed, options, revision, today)`. Each returns the body parsed through the `rx-resume` schema, so a too-long name fails before any request |
| `generate.ts` | `generateCoverLetter(client, body)` |
| `update.ts` | `updateCoverLetter(client, id, build)`: `GET`, then `build(revision)`, then `PUT` |
| `delete.ts` | `deleteCoverLetter(client, id)`: `GET`, trash, purge. If the purge fails, it throws with "letter <id> is in Trash" added to the API error |
| `run.ts` | `runGenerateCoverLetter`, `runUpdateCoverLetter`, `runDeleteCoverLetter`: read the file, build the client, print. `today` is injected and defaults to `DateTime.now().toISODate()` (local time zone) |
| `mocks.ts` | A fake client and a fixed `today` |
| `fixtures/CoverLetter.md` | A synthetic letter (Jane Doe / Acme BV). Already allowed by `.gitignore` (`!src/**/fixtures/*.md`) |

UI strings go in a `CoverLetterLabel` enum.

### `src/cli/`: new `OptionKind.Choice`

The CLI has no option kind for a value picked from a fixed list. It's added
generically so any tool can use one later.

| File | Change |
| ---- | ------ |
| `types.ts` | `OptionKind.Choice = "choice"`; `ChoiceOption extends BaseOption { kind: OptionKind.Choice; choices: readonly string[] }` added to `OptionSpec`; `ParsedValue` narrows to `TOption["choices"][number]`, so `run` receives the template union and not `string`; `CliLabel.MustBeOneOf` |
| `define-tool.ts` | `placeholder` returns `<flag>` for a choice. `parseToolArgs` rejects a value that isn't in `choices`, with `--template must be one of azurill, …` |
| `prompt-options.ts` | `ask` uses `prompter.select` (already in `Prompter`) for a choice option and `input` for everything else |
| `command.ts`, `menu.ts`, `index.ts` | No change expected; to be checked during implementation |

A select prompt can't produce an invalid value, so `cli/schema.ts` (which
holds the interactive-only validators) doesn't change.

### `src/cli/tools/`

- `generate-cover-letter.ts`, `update-cover-letter.ts` and
  `delete-cover-letter.ts` are thin files that call `src/cover-letter/run.ts`.
  The `--template` option is
  `{ kind: OptionKind.Choice, choices: Object.values(CoverLetterTemplate) }`.
- `registry.ts` appends the three tools.

### Other files

- `package.json`: `bun add luxon` and `bun add -d @types/luxon`.
- `README.md`: a usage section for the three tools.
- `CLAUDE.md`: removes the "`cover-letter/index.ts` is an empty placeholder"
  gotcha, and adds `cover-letter/` to the folder table.
- `docs/interactive-cli.md`: notes `OptionKind.Choice` next to `Path`, `Text`
  and `List`.

## Delivery: test first, in this order

Each step is a red test, then the code, then `bunx vitest run` and
`bun run typecheck`.

1. **CLI `Choice` kind.** `define-tool.test.ts` covers parsing a valid choice,
   rejecting an invalid one, and the usage placeholder. `prompt-options.test.ts`
   checks that a choice option calls `select` with every choice.
2. **API schemas.** `schema.test.ts` checks that the create and update bodies
   accept the fixture body and reject a 101-char name, a bad `letterDate`, an
   unknown template, and an update without `expectedRevision`.
3. **Client.** `client.test.ts` checks each of the five methods' method, path,
   body and API-key header against the injected `fetch`, and that trash sends
   `{ expectedRevision }` on DELETE.
4. **Config.** `resolveLetterDashboardUrl` handles a trailing slash and a local
   origin.
5. **Parser.** `parser.test.ts` uses the fixture to produce `recipient` and
   `content`. Each missing section fails with its own path, and `---` rules are
   dropped.
6. **Bodies.** `layout: "freeform"` and `letterDate` are always set. On update,
   optional flags are left out when not given. `--company` maps to
   `recipientCompany`.
7. **Flows.**
   - Generate posts once.
   - Update does `GET` then `PUT` with the fetched revision, and a rejected
     `PUT` comes back as the API error.
   - Delete does `GET`, trash, purge in order. A failed purge produces the "in
     Trash" message, and a failed trash never purges.
8. **Tools and registry.** The three tools appear in the menu under Reactive
   Resume and are disabled without `.env`.
9. **Docs and formatting.** Update the docs, then run `bun run format`.

## Risks and open questions for review

1. **Relinking on update.** `--resume-id` on update sends `resumeId`. The plan
   doesn't also send `senderLinked: true` / `designLinked: true`. If changing
   the resume doesn't relink the sender by itself, we should send
   `senderLinked: true` (and `designLinked: true` unless `--template` is
   given). Should we send them explicitly?
2. **`recipientCompany` in freeform.** The API says `structured` prints the
   company fields. In `freeform`, `--company` is probably stored but not
   printed. That's acceptable, since the company is in `## Contact`, but it
   hasn't been checked against a real letter.
3. **Updating a `structured` letter.** Resolved. `PUT` can't change `layout`,
   so a letter made in the app in `structured` layout would print its
   greeting and sign-off twice. Update reads `layout` from the `GET` and
   refuses any letter that isn't `freeform` with a `CoverLetterError`
   (`NOT_FREEFORM`), before the `PUT` is sent.
4. **Time zone.** `letterDate` uses the machine's local date, which is right
   for a letter signed today. It's recorded here so a reviewer can object.
5. **Partial delete.** If the purge fails after the trash succeeds, the letter
   is left in Trash. That's recoverable, and the error says so, so there's no
   rollback.
6. **Hard-wrapped paragraphs.** Line breaks are kept, so a `.md` wrapped at 80
   columns (e.g. by Prettier, as `Resume.md` is) sends its breaks mid-sentence.
   `Resume.md` avoids this by joining wrapped lines (`unwrapLines`). The
   fixture keeps each paragraph on one line. Should the letter join wrapped
   lines too, keeping only the breaks in `## Contact` and `## Closing`?

## Implementation notes

- **Two-step validation.** `ParsedCoverLetterSchema` (`recipient`, `content`)
  can't name a missing section, so the parser first checks
  `CoverLetterSectionsSchema` (`contact`, `letter`, `closing`) and gets
  `closing: required`. It then checks `ParsedCoverLetterSchema` for the API's
  length limits.
- **Shared error format.** `sync-resume/schema.ts` gains
  `parseOrThrow(schema, value, heading)`, which `validateParsedResume` now
  uses, and exports `requiredText`. The parser reports
  `Invalid cover letter:` and the bodies `Invalid cover letter request:`, each
  followed by one `path: message` line per failure.
- **Update validates after the read.** The update body needs the revision, so
  `build(revision)` runs after the `GET`. A too-long `--name` still fails
  before the `PUT`. A create fails before any request.
- **Fixtures.** `src/rx-resume/mocks.ts` holds the cover-letter bodies,
  response and invalid-field cases, shared by the rx-resume tests and
  `cover-letter/mocks.ts`. The fake client records its calls without
  `vi.fn()`, as the CLI design doc asks.
- **Response schema.** `CoverLetterSchema.letterDate` is nullable, as in the
  API. The bodies don't accept `null`, since the tools always send a date.
- **Dashboard link.** The tools link to the letter itself,
  `<appUrl>/dashboard/<id>`, under `letter:`, instead of the letter list
  (`/dashboard?type=letter`) the plan described.
- **Output.** `, template <name>` is printed on update too when `--template`
  is given.
- **Removed.** The empty `src/cover-letter/index.ts`. As in the other domain
  folders, `run.ts` is the entry point.
- **Tests added beyond the plan.** `cli/registry.test.ts` (step 8), plus a
  type-level check that a choice reaches `run` as the union of its values.
- **Review follow-ups.**
  - Update refuses a letter that isn't `freeform` (risk 3).
  - Failures the flows own are `CoverLetterError`s (`cover-letter/errors.ts`)
    with a typed `reason`: `NOT_FREEFORM`, or `LEFT_IN_TRASH` when the purge
    fails. Both extend `ReasonedError` in `src/utils/error.ts`, like the CLI's
    `CliError`.
  - The client is the `RxResumeApiClient` class, which implements the
    `RxResumeClient` interface. Its path helpers use `itemPath` and
    `trimTrailingSlashes` from `src/utils/url.ts`.
  - `CoverLetterFields` types each flag by the API field it's sent as, e.g.
    `company?: UpdateCoverLetterBody["recipientCompany"]`.
  - The tool files pass `camelCaseKeys(values)` to the runs, so each
    kebab-case flag has to match its option field at compile time.
  - The README links here instead of repeating the usage.
