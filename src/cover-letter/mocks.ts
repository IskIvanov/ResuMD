/**
 * mocks.ts
 *
 * Every fixture the cover-letter tests use: the synthetic letter and what it
 * parses to, variants with a section missing, a fixed date, a letter in the
 * structured layout and a fake client that records its calls. Typed constants
 * and small factories only.
 */

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { RxResumeApiError } from "../rx-resume/client.ts";
import { coverLetter, LETTER_DATE } from "../rx-resume/mocks.ts";
import { type CoverLetter, CoverLetterLayout } from "../rx-resume/types.ts";
import type { ValueOf } from "../utils/type.ts";
import type {
  DeleteLetterClient,
  GenerateLetterClient,
  ParsedCoverLetter,
  UpdateLetterClient,
} from "./types.ts";

// ─── The letter ───────────────────────────────────────────────────────────────

const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures");

/** fixtures/CoverLetter.md: Jane Doe writing to Acme BV. */
export const COVER_LETTER_MD = readFileSync(
  resolve(FIXTURES, "CoverLetter.md"),
  "utf-8",
);

/** What COVER_LETTER_MD parses to. */
export const parsedLetter: ParsedCoverLetter = {
  recipient: [
    "Manager",
    "Hiring Manager",
    "Acme BV",
    "Amsterdam, Netherlands",
  ].join("\n"),
  content: [
    "Dear Sender,",
    "",
    "I'm writing to apply for the Frontend Engineer role at Acme BV. For the last five years I've built typed component libraries for products used every day.",
    "",
    "At Example Corp I led the migration of a legacy dashboard, which cut release time in half. I'd **love** to bring that experience to your team.",
    "",
    "Kind regards,",
    "Jane Doe",
  ].join("\n"),
};

/** The date every body is built with, so tests don't depend on the clock. */
export const TODAY = LETTER_DATE;

/** Matches a `## Heading` line and its body, up to the next `## ` heading. */
function sectionPattern(heading: string): RegExp {
  return new RegExp(`## ${heading}\\n[\\s\\S]*?(?=\\n## |$)`);
}

/**
 * The fixture with one section, heading and body, removed.
 *
 * @example
 * withoutSection("Closing"); // no `## Closing`
 */
export function withoutSection(heading: string): string {
  return COVER_LETTER_MD.replace(sectionPattern(heading), "");
}

/**
 * The fixture with one section's body reduced to a `---` rule.
 *
 * @example
 * withEmptySection("Contact"); // "## Contact\n\n---\n\n## Letter…"
 */
export function withEmptySection(heading: string): string {
  return COVER_LETTER_MD.replace(
    sectionPattern(heading),
    `## ${heading}\n\n---\n`,
  );
}

// ─── Fake client ──────────────────────────────────────────────────────────────

export const LetterMethod = {
  Create: "createCoverLetter",
  Get: "getCoverLetter",
  Update: "updateCoverLetter",
  Trash: "trashCoverLetter",
  Purge: "purgeCoverLetter",
} as const;
export type LetterMethod = ValueOf<typeof LetterMethod>;

/** One call the fake client received. */
export interface LetterCall {
  method: LetterMethod;
  args: unknown[];
}

type FakeClient = GenerateLetterClient &
  UpdateLetterClient &
  DeleteLetterClient;

/** A fake client plus every call it received, in order. */
export interface FakeLetterClient {
  client: FakeClient;
  calls: LetterCall[];
}

/** The fixture letter as made in the app's structured layout. */
export const structuredLetter: CoverLetter = {
  ...coverLetter,
  layout: CoverLetterLayout.Structured,
};

/** How a fake client behaves; by default every call succeeds. */
export interface FakeLetterClientOptions {
  /** A method that records its call, then rejects with apiError. */
  failing?: LetterMethod;
  /** What reads return; the fixture letter unless set. */
  stored?: CoverLetter;
}

/** What the fake's failing method rejects with. */
export const apiError = new RxResumeApiError(
  409,
  "COVER_LETTER_REVISION_CONFLICT",
  "The cover letter has changed since it was read.",
);

/**
 * Builds a fake client that records its calls. Reads return the stored
 * letter; a create returns it at revision 1, an update one revision on.
 *
 * @param options - A method that fails, and the letter reads return.
 *
 * @example
 * const { client, calls } = createFakeLetterClient({ failing: LetterMethod.Purge });
 */
export function createFakeLetterClient({
  failing,
  stored = coverLetter,
}: FakeLetterClientOptions = {}): FakeLetterClient {
  const calls: LetterCall[] = [];
  const call = async <TResult>(
    method: LetterMethod,
    args: unknown[],
    result: TResult,
  ): Promise<TResult> => {
    calls.push({ method, args });
    if (method === failing) throw apiError;
    return result;
  };

  const client: FakeClient = {
    createCoverLetter: (body) =>
      call(LetterMethod.Create, [body], {
        ...stored,
        name: body.name,
        revision: 1,
      }),
    getCoverLetter: (id) => call(LetterMethod.Get, [id], stored),
    updateCoverLetter: (id, body) =>
      call(LetterMethod.Update, [id, body], {
        ...stored,
        revision: stored.revision + 1,
      }),
    trashCoverLetter: (id, expectedRevision) =>
      call(LetterMethod.Trash, [id, expectedRevision], undefined),
    removeCoverLetter: (id) => call(LetterMethod.Purge, [id], undefined),
  };
  return { client, calls };
}
